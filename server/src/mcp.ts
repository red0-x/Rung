import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from './config.js';
import type { DialClient } from './dial.js';
import type { Keewano } from './keewano.js';
import { waitUntil } from '@vercel/functions';
import { maskPhone, type CallerCtx } from './identity.js';
import { RateLimitError, type OtpService } from './otp.js';
import { rankQueued } from './queue.js';
import { repsForEta } from './reps.js';
import { estimateCallbackMinutes, scoreItem } from './scoring.js';
import { describeFacts, factsInput, hasFacts, mergeFacts, missingFacts } from './facts.js';
import { clockTime, confirmationSms, smsText } from './sms.js';
import type { Store } from './store/types.js';
import { INTENTS, type Org, type QueueItem, type Trust } from './types.js';

export { smsText };

export interface Deps {
  store: Store;
  otp: OtpService;
  dial: DialClient;
  cfg: Config;
  now: () => number;
  log: (msg: string) => void;
  /** Optional analytics; never blocks or fails a tool call. */
  keewano?: Keewano;
}

/** A second triage_call from the same number inside this window updates the waiting item instead of adding a duplicate. */
const DEDUPE_MS = 3 * 60_000;
/** How many past issues lookup_caller returns. */
const RECENT_ISSUES = 3;

const ok = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
});

const fail = (error: string, message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: JSON.stringify({ error, message }) }],
});

/** Collapse whitespace; title-case only when the name came in all lower or all upper case. */
export function normalizeName(raw: string | undefined | null): string | undefined {
  const n = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!n) return undefined;
  if (n === n.toLowerCase() || n === n.toUpperCase()) {
    return n.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return n;
}

function relativeDay(then: number, now: number): string {
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * One server instance per request, closed over the org (from the MCP URL token or
 * the dialed number) and the caller (from Dial's headers). No tool takes a phone
 * number: the only person whose data a tool can touch is the person on the line,
 * and only at the company they called. No LLM calls in here: tools must answer fast.
 */
export function buildMcpServer(org: Org | null, ctx: CallerCtx, deps: Deps): McpServer {
  const { store, otp, dial, cfg, now, log } = deps;
  const server = new McpServer({ name: 'rung', version: '1.0.0' });

  const identify = (): { phone: string; org: Org } | { err: CallToolResult } => {
    if (!org) {
      return {
        err: fail('org_unknown', 'This phone line is not connected to a Rung account. Apologize and ask the caller to try again later.'),
      };
    }
    if (!ctx.phone) {
      return {
        err: fail('caller_unknown', 'The phone system did not provide a valid caller number. Apologize and ask the caller to try again.'),
      };
    }
    if (cfg.requireInbound && ctx.direction !== 'inbound') {
      return { err: fail('not_allowed', 'This tool is only available on inbound calls.') };
    }
    return { phone: ctx.phone, org };
  };
  /** Fire-and-forget. On Vercel, waitUntil keeps the function alive for delivery without delaying the tool reply. */
  const emit = (event: Parameters<Keewano['track']>[0], o: Org, phone: string, qualifier?: string) => {
    const k = deps.keewano;
    if (!k?.enabled) return;
    k.track(event, o.slug, phone, qualifier);
    if (cfg.inlineWebhooks) waitUntil(k.flush().catch(() => {}));
  };
  const tag = (o: Org, phone: string) => `[${o.slug}] ${maskPhone(phone, '*')}`;

  server.registerTool(
    'lookup_caller',
    {
      title: 'Look up caller',
      description:
        'Call this first, before asking the caller anything. Takes no arguments: the caller is identified automatically from their phone number. ' +
        'Returns whether they have a saved profile, their name, their recent issues, and any callback already pending, plus guidance on what to say.',
    },
    async () => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      const t = now();
      const s = o.settings;
      // One round of parallel reads: profile, this number's history, the org's active queue (for position).
      const [profile, history, active, members] = await Promise.all([
        store.getProfile(o.id, phone),
        store.phoneHistory(o.id, phone, RECENT_ISSUES),
        store.listQueueItems(o.id, { statuses: ['queued', 'in_progress'] }),
        store.listMembers(o.id),
      ]);
      const recent = history.items;
      const last = recent[0];
      const named = recent.find((i) => i.name);
      const name = profile?.name ?? named?.name ?? null;
      const nameSource = profile ? 'profile' : named ? 'previous_call' : null;
      const firstName = name ? name.trim().split(/\s+/)[0]! : null;

      const openItem = active.filter((i) => i.phone === phone).sort((x, y) => y.createdAt - x.createdAt)[0];
      let openRequest: { summary: string; status: string; position: number | null; estimated_callback_minutes: number | null } | null = null;
      if (openItem) {
        if (openItem.status === 'queued') {
          const ranked = rankQueued(active, t, s);
          const position = ranked.findIndex((r) => r.item.id === openItem.id) + 1;
          openRequest = {
            summary: openItem.summary,
            status: 'queued',
            position,
            estimated_callback_minutes: estimateCallbackMinutes(position, s.avgHandleMin, repsForEta(members, t, s)),
          };
        } else {
          openRequest = { summary: openItem.summary, status: 'in_progress', position: null, estimated_callback_minutes: null };
        }
      }

      const lastIssue = last ? `"${last.summary}" (${relativeDay(last.createdAt, t)})` : null;
      const openLine = openRequest
        ? openRequest.status === 'queued'
          ? ` They already have a callback pending: it is #${openRequest.position} in line, about ${openRequest.estimated_callback_minutes} minutes away. Tell them, and ask if this call is about the same thing.`
          : ' A specialist is already working on their open request. Tell them, and ask if this call is about the same thing.'
        : lastIssue
          ? ` Ask whether this is about their last issue, ${lastIssue}, or something new.`
          : ' Ask what you can help with.';
      let guidance: string;
      if (profile) {
        const known = describeFacts(profile.facts);
        const gaps = missingFacts(profile.facts);
        // Recognized: greet by name, show we have their details, ask one open question. Past issues are
        // reference only, so the caller is not quizzed about last time.
        const profileLine = openRequest
          ? openLine
          : lastIssue
            ? ` Do not bring up their past issues unless they do. For your reference only, their last one was ${lastIssue}.`
            : '';
        guidance =
          `Returning caller. Say "Hi ${firstName}, I've got your details up. What can I help you with today?"${profileLine}` +
          (known
            ? ` What you already know about them (use it naturally, never recite it, never ask for it again): ${known}.`
            : '') +
          (gaps.length
            ? ` You do not yet know their ${gaps.join(' or ')}. After triage_call, if the moment is natural, ask once and save the answer with update_profile. If they decline, drop it.`
            : '');
      } else if (history.total > 0) {
        guidance =
          `You've spoken before (${history.total} ${history.total === 1 ? 'call' : 'calls'}) but they haven't saved their name. ` +
          (name
            ? `Say "Welcome back" and confirm the name they gave last time: "Is this still ${name}?"`
            : 'Say "Welcome back" without a name. They never gave a name: once you understand the issue, ask for their first and last name (confirm the spelling if it is long or unusual) and pass it as caller_name.') +
          `${openLine} After triage_call, offer to remember them by this number.`;
      } else {
        guidance =
          `New caller. Say "${s.greeting}" and ask what happened. Once you understand the issue, ask for their first and last name ` +
          '(confirm the spelling if it is long or unusual) and pass it to triage_call as caller_name. Then offer to remember them by this number.';
      }

      emit('call_started', o, phone, profile ? 'known' : 'new');
      log(`lookup_caller ${tag(o, phone)} known=${!!profile} calls=${history.total} open=${openRequest?.status ?? 'none'}`);
      return ok({
        known: !!profile,
        name,
        first_name: firstName,
        name_source: nameSource,
        last_issue: last ? { summary: last.summary, when: relativeDay(last.createdAt, t) } : null,
        recent_issues: recent.map((i) => ({
          summary: i.summary,
          intent: i.intent,
          intent_label: s.intents[i.intent]?.label ?? i.intent,
          when: relativeDay(i.createdAt, t),
          status: i.status,
        })),
        call_count: history.total,
        previous_calls: profile ? null : history.total,
        facts: profile && hasFacts(profile.facts) ? profile.facts : null,
        missing_facts: profile ? missingFacts(profile.facts) : null,
        has_open_request: !!openItem,
        open_request: openRequest,
        org_name: o.name,
        guidance,
      });
    },
  );

  // Texted-code tools exist only when verification is on (REQUIRE_VERIFICATION=true).
  if (cfg.requireVerification) {
  server.registerTool(
    'send_code',
    {
      title: 'Text a verification code',
      description:
        "Texts a 6-digit verification code to the caller's phone. Takes no arguments. Use it only after the caller agrees to save their profile, or when triage_call asks for verification. " +
        'Never say the code aloud: ask the caller to read it back to you.',
    },
    async () => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      try {
        const { code } = await otp.issue(o.id, phone);
        try {
          await dial.sendSms(
            phone,
            smsText(`${o.name}: your verification code is ${code}. It expires in 5 minutes. If you did not call us, ignore this text.`),
            o.dialNumber,
            { orgId: o.id },
          );
        } catch (err) {
          if (!cfg.demoShowCodes) {
            log(`send_code ${tag(o, phone)} sms failed: ${(err as Error).message}`);
            return fail('sms_failed', 'The text message could not be sent. Offer to try once more, or continue without saving.');
          }
          // Demo-day fallback: the code is on the dashboard, so the call can continue.
          log(`send_code ${tag(o, phone)} sms FAILED, continuing because demo codes are on: ${(err as Error).message}`);
        }
        emit('code_sent', o, phone);
        log(`send_code ${tag(o, phone)}`);
        return ok({
          sent: true,
          expires_in_minutes: 5,
          guidance: 'Ask the caller to read the 6-digit code from the text, then call check_code with it.',
        });
      } catch (err) {
        if (err instanceof RateLimitError) return fail('rate_limited', err.message);
        throw err;
      }
    },
  );

  server.registerTool(
    'check_code',
    {
      title: 'Check verification code',
      description: 'Checks the 6-digit code the caller read back from their text message.',
      inputSchema: {
        code: z.string().min(4).max(32).describe('The digits the caller read out. Spaces and dashes are fine.'),
      },
    },
    async ({ code }) => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      const res = await otp.verify(o.id, phone, code);
      log(`check_code ${tag(o, phone)} ${res.ok ? 'ok' : res.reason}`);
      emit(res.ok ? 'code_verified' : 'code_failed', o, phone);
      if (res.ok) {
        return ok({ verified: true, guidance: 'Verified. Continue with what the caller needs.' });
      }
      if (res.reason === 'wrong_code') {
        return ok({
          verified: false,
          attempts_left: res.attemptsLeft,
          guidance: 'That code did not match. Ask them to read it again, slowly, digit by digit.',
        });
      }
      return ok({
        verified: false,
        reason: res.reason,
        attempts_left: 0,
        guidance:
          res.reason === 'locked'
            ? 'Too many wrong attempts. Do not retry; offer to continue without saving.'
            : 'The code is no longer valid. Offer to send a new one with send_code.',
      });
    },
  );
  }

  server.registerTool(
    'save_profile',
    {
      title: 'Save caller profile',
      description:
        cfg.requireVerification
          ? "Saves the caller's name so future calls from this number start with context. Requires that the caller just passed check_code and said yes to saving their details."
          : "Saves the caller's name so future calls from this number start with context. Only call it after the caller clearly said yes to saving their details.",
      inputSchema: {
        name: z.string().min(1).max(80).describe("The caller's full name as they said it."),
        consent: z.boolean().describe('True only if the caller explicitly agreed to save their details.'),
        facts: factsInput.optional().describe('Anything else they already told you this call: occupation, household, and so on. Only what they actually said.'),
      },
    },
    async ({ name, consent, facts }) => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      if (!consent) return fail('consent_required', 'Only save a profile after the caller explicitly agrees.');
      if (cfg.requireVerification && !(await otp.isVerified(o.id, phone))) {
        return fail('verification_required', 'Verify the caller first: send_code, then check_code, then save_profile.');
      }
      const t = now();
      const clean = normalizeName(name);
      if (!clean) return fail('name_required', 'Ask for their first and last name before saving.');
      const profile = await store.upsertProfile({
        orgId: o.id,
        phone,
        name: clean,
        consentAt: t,
        // Only a texted code proves the number; consent alone never claims verified.
        verifiedAt: cfg.requireVerification ? t : undefined,
        ...(facts ? { facts: mergeFacts(undefined, facts, t), factsUpdatedAt: t } : {}),
        createdAt: t,
      });
      // Backfill the request this caller just made, if it was queued without a name.
      const open = await store.latestQueueItemForPhone(o.id, phone, ['queued', 'in_progress']);
      if (open && !open.name) await store.updateQueueItem(open.id, { name: clean });
      emit('profile_saved', o, phone);
      if (facts && hasFacts(profile.facts)) emit('context_saved', o, phone, String(Object.values(facts).filter(Boolean).length));
      log(`save_profile ${tag(o, phone)}`);
      return ok({
        saved: true,
        name: profile.name,
        facts_saved: hasFacts(profile.facts),
        guidance: 'Tell the caller their details are saved for next time.',
      });
    },
  );

  server.registerTool(
    'update_profile',
    {
      title: 'Remember more about the caller',
      description:
        'Adds what the caller just told you (occupation, household, location, preferences, one-off notes) to their saved profile, so every future call starts with it. ' +
        'Only works for callers who already agreed to be remembered. Send only what they actually said, in their words. Never store account numbers, passwords, health or other sensitive details. ' +
        'New values replace old ones for the same field; notes are added.',
      inputSchema: factsInput.shape,
    },
    async (input) => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      const profile = await store.getProfile(o.id, phone);
      if (!profile) {
        return fail('no_profile', 'This caller has not agreed to be remembered yet. Ask first, then call save_profile with consent.');
      }
      const t = now();
      if (!hasFacts(mergeFacts(undefined, input, t))) return fail('nothing_to_save', 'Send at least one thing the caller actually told you.');
      const facts = mergeFacts(profile.facts, input, t);
      await store.upsertProfile({ ...profile, facts, factsUpdatedAt: t });
      emit('context_saved', o, phone, String(Object.values(input).filter(Boolean).length));
      log(`update_profile ${tag(o, phone)} fields=${Object.keys(input).filter((k) => (input as Record<string, unknown>)[k]).join(',')}`);
      return ok({ saved: true, remembered: describeFacts(facts), guidance: 'Briefly acknowledge ("Got it, thanks.") and move on. Do not read their details back.' });
    },
  );

  server.registerTool(
    'triage_call',
    {
      title: 'Queue a callback',
      description:
        'Puts the caller in the callback queue with a priority and a short brief for the human specialist. Call it once you understand the issue. ' +
        'Choose the intent that fits best: fraud_in_progress (money is being taken right now), medical_emergency, locked_out, payment_issue, ' +
        'money_movement (wire/transfer), account_change, dispute (a charge they dispute), account_opening, general_question, other.',
      inputSchema: {
        intent: z.enum(INTENTS).describe('What the caller needs.'),
        amount_usd: z.number().nonnegative().max(1e10).optional().describe('Dollar amount at stake, if any.'),
        summary: z
          .string()
          .min(5)
          .max(600)
          .describe(
            'The rep reads this in 5 seconds. Third person, facts only, exactly this shape: ' +
              'sentence 1 = headline (who, what, how much, under 20 words). ' +
              'Then "When: ...". "Tried: ..." (what the caller already did, or "nothing"). "Wants: ..." (the outcome they asked for). ' +
              'Add "Best time: ..." only if they named a callback time. Leave out a line you do not know. No filler, no guesses.',
          ),
        caller_name: z
          .string()
          .max(80)
          .optional()
          .describe("Caller's full name exactly as confirmed (spelling checked). Required unless they have a saved profile or refused to give it."),
      },
    },
    async ({ intent, amount_usd, summary, caller_name }) => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      const s = o.settings;
      const meta = s.intents[intent];
      // Without verification, nobody is 'verified': a number only recognizes.
      const verified = cfg.requireVerification && (await otp.isVerified(o.id, phone));

      // Caller ID can be spoofed: a number recognizes, only a texted code authorizes.
      // With verification off, sensitive requests are queued; the specialist verifies on the callback.
      if (cfg.requireVerification && meta.sensitive && !verified) {
        return fail(
          'verification_required',
          'This request involves moving money or changing an account. Verify the caller first: call send_code, ask them to read the code, call check_code, then call triage_call again.',
        );
      }

      const profile = await store.getProfile(o.id, phone);
      const trust: Trust = verified ? 'verified' : profile ? 'recognized' : 'new';
      const givenName = profile?.name ?? normalizeName(caller_name);
      const t = now();
      const fields: Partial<QueueItem> & Pick<QueueItem, 'phone' | 'intent' | 'summary' | 'trust'> = {
        phone,
        agentNumber: ctx.agentNumber ?? undefined,
        intent,
        amountUsd: amount_usd,
        summary: summary.trim(),
        trust,
      };
      // Only set the name when we have one: an update must never erase a name given earlier in the call.
      if (givenName) fields.name = givenName;

      const waiting = await store.latestQueueItemForPhone(o.id, phone, ['queued']);
      let item: QueueItem;
      if (waiting && t - waiting.createdAt < DEDUPE_MS) {
        // Agents sometimes call a tool twice. Keep the original createdAt (and returning flag) so the wait is not reset.
        item = (await store.updateQueueItem(waiting.id, fields)) ?? waiting;
      } else {
        // "Returning" = had a saved profile before this call (a profile saved during this call doesn't count).
        const returning = !!profile && profile.createdAt < t - DEDUPE_MS;
        item = await store.addQueueItem({ id: randomUUID(), orgId: o.id, status: 'queued', createdAt: t, returning, ...fields });
      }

      const [queuedNow, members] = await Promise.all([store.listQueueItems(o.id, { statuses: ['queued'] }), store.listMembers(o.id)]);
      const ranked = rankQueued(queuedNow, t, s);
      const position = Math.max(1, ranked.findIndex((r) => r.item.id === item.id) + 1);
      // Once the confirmation text is out, that time is the promise: a repeat triage_call (name backfill) must not change it.
      const texted0 = item.smsStatus === 'sent' && item.etaMinutes !== undefined && item.etaAt !== undefined;
      const eta = texted0 ? item.etaMinutes! : estimateCallbackMinutes(position, s.avgHandleMin, repsForEta(members, t, s));
      const etaAt = texted0 ? item.etaAt! : t + eta * 60_000;
      const score = scoreItem(item, t, s);
      emit('call_queued', o, phone, score.tier);
      log(`triage_call ${tag(o, phone)} ${intent} -> #${position} (${score.total} pts)`);

      // The request is saved. Record the exact promise (minutes + clock time), then text it once.
      // Nothing here may fail the call: the caller is told the ETA out loud either way, and the
      // bookkeeping columns come from a migration that may not be applied yet.
      const track = async (patch: Partial<QueueItem>) => {
        try {
          item = (await store.updateQueueItem(item.id, patch)) ?? item;
        } catch (err) {
          log(`triage_call ${tag(o, phone)} could not record eta/sms state: ${(err as Error).message}`);
        }
      };
      let texted = texted0;
      if (!texted0) {
        await track({ etaMinutes: eta, etaAt });
        if (!o.dialNumber) {
          await track({ smsStatus: 'skipped', smsError: 'org has no Dial number to text from' });
          emit('eta_text', o, phone, 'skipped');
        } else {
          try {
            await dial.sendSms(
              phone,
              confirmationSms({
                orgName: o.name,
                firstName: item.name?.trim().split(/\s+/)[0],
                etaMinutes: eta,
                etaAt,
                position,
                timeZone: s.timezone,
              }),
              o.dialNumber,
              { orgId: o.id },
            );
            texted = true;
            emit('eta_text', o, phone, 'sent');
            await track({ smsStatus: 'sent', smsSentAt: now(), smsError: undefined });
          } catch (err) {
            log(`triage_call ${tag(o, phone)} confirmation sms failed: ${(err as Error).message}`);
            await track({ smsStatus: 'failed', smsError: (err as Error).message.slice(0, 300) });
            emit('eta_text', o, phone, 'failed');
          }
        }
      }

      const nameMissing = !item.name;
      return ok({
        queued: true,
        position,
        estimated_callback_minutes: eta,
        estimated_callback_at: clockTime(etaAt, s.timezone),
        confirmation_text_sent: texted,
        priority: score.reason,
        name_missing: nameMissing,
        say_to_caller:
          `A specialist from ${o.name} already has your details and will call you back on this number in about ${eta} minutes, around ${clockTime(etaAt, s.timezone)}. ` +
          (texted ? 'I just texted you a confirmation with the same time. ' : '') +
          'No need to hold.',
        guidance: nameMissing
          ? 'Before you end the call, ask for their first and last name (confirm the spelling if it is long or unusual), then call triage_call again with caller_name: it updates this same request. If they refuse, skip it. Then tell the caller the callback estimate, thank them, and end the call.'
          : 'Tell the caller the callback estimate, thank them, and end the call. Do not make promises beyond that.',
      });
    },
  );

  return server;
}
