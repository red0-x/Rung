import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from './config.js';
import type { DialClient } from './dial.js';
import { maskPhone, type CallerCtx } from './identity.js';
import { RateLimitError, type OtpService } from './otp.js';
import { rankQueued } from './queue.js';
import { estimateCallbackMinutes, scoreItem } from './scoring.js';
import type { Store } from './store/types.js';
import { INTENTS, type Org, type QueueItem, type Trust } from './types.js';

export interface Deps {
  store: Store;
  otp: OtpService;
  dial: DialClient;
  cfg: Config;
  now: () => number;
  log: (msg: string) => void;
}

/** A second triage_call from the same number inside this window updates the waiting item instead of adding a duplicate. */
const DEDUPE_MS = 3 * 60_000;

const ok = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
});

const fail = (error: string, message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: JSON.stringify({ error, message }) }],
});

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
  const tag = (o: Org, phone: string) => `[${o.slug}] ${maskPhone(phone, '*')}`;

  server.registerTool(
    'lookup_caller',
    {
      title: 'Look up caller',
      description:
        'Call this first, before asking the caller anything. Takes no arguments: the caller is identified automatically from their phone number. ' +
        'Returns whether they have a saved profile, their name, and their most recent issue so you can greet them personally.',
    },
    async () => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      const t = now();
      const [profile, last, open] = await Promise.all([
        store.getProfile(o.id, phone),
        store.latestQueueItemForPhone(o.id, phone),
        store.latestQueueItemForPhone(o.id, phone, ['queued', 'in_progress']),
      ]);
      log(`lookup_caller ${tag(o, phone)} known=${!!profile}`);
      return ok({
        known: !!profile,
        name: profile?.name ?? null,
        first_name: profile ? profile.name.split(' ')[0] : null,
        last_issue: last ? { summary: last.summary, when: relativeDay(last.createdAt, t) } : null,
        has_open_request: !!open,
        org_name: o.name,
        guidance: profile
          ? 'Greet them by first name and ask whether this is about their last issue or something new.'
          : `New caller. Say "${o.settings.greeting}" and ask what happened. After you understand the issue, offer to save their details so next time is instant.`,
      });
    },
  );

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
            `${o.name}: your verification code is ${code}. It expires in 5 minutes. If you did not call us, ignore this text.`,
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

  server.registerTool(
    'save_profile',
    {
      title: 'Save caller profile',
      description:
        "Saves the caller's name so future calls from this number start with context. Requires that the caller just passed check_code and said yes to saving their details.",
      inputSchema: {
        name: z.string().min(1).max(80).describe("The caller's full name as they said it."),
        consent: z.boolean().describe('True only if the caller explicitly agreed to save their details.'),
      },
    },
    async ({ name, consent }) => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      if (!consent) return fail('consent_required', 'Only save a profile after the caller explicitly agrees.');
      if (!(await otp.isVerified(o.id, phone))) {
        return fail('verification_required', 'Verify the caller first: send_code, then check_code, then save_profile.');
      }
      const t = now();
      const profile = await store.upsertProfile({
        orgId: o.id,
        phone,
        name: name.trim(),
        consentAt: t,
        verifiedAt: t,
        createdAt: t,
      });
      log(`save_profile ${tag(o, phone)}`);
      return ok({ saved: true, name: profile.name, guidance: 'Tell the caller their details are saved for next time.' });
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
            'A 2-3 sentence brief for the specialist, third person, facts only: what happened, when, how much, what the caller wants. They will read this before calling back.',
          ),
        caller_name: z.string().max(80).optional().describe("The caller's name if they gave it and they have no saved profile."),
      },
    },
    async ({ intent, amount_usd, summary, caller_name }) => {
      const id = identify();
      if ('err' in id) return id.err;
      const { org: o, phone } = id;
      const s = o.settings;
      const meta = s.intents[intent];
      const verified = await otp.isVerified(o.id, phone);

      // Caller ID can be spoofed: a number recognizes, only a texted code authorizes.
      if (meta.sensitive && !verified) {
        return fail(
          'verification_required',
          'This request involves moving money or changing an account. Verify the caller first: call send_code, ask them to read the code, call check_code, then call triage_call again.',
        );
      }

      const profile = await store.getProfile(o.id, phone);
      const trust: Trust = verified ? 'verified' : profile ? 'recognized' : 'new';
      const name = profile?.name ?? (caller_name?.trim() || undefined);
      const t = now();
      const fields = {
        phone,
        agentNumber: ctx.agentNumber ?? undefined,
        name,
        intent,
        amountUsd: amount_usd,
        summary: summary.trim(),
        trust,
      };

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

      const ranked = rankQueued(await store.listQueueItems(o.id, { statuses: ['queued'] }), t, s);
      const position = Math.max(1, ranked.findIndex((r) => r.item.id === item.id) + 1);
      const eta = estimateCallbackMinutes(position, s.avgHandleMin, s.repsOnShift);
      const score = scoreItem(item, t, s);
      log(`triage_call ${tag(o, phone)} ${intent} -> #${position} (${score.total} pts)`);

      return ok({
        queued: true,
        position,
        estimated_callback_minutes: eta,
        priority: score.reason,
        say_to_caller: `A specialist from ${o.name} already has your details and will call you back on this number in about ${eta} minutes. No need to hold.`,
        guidance: 'Tell the caller the callback estimate, thank them, and end the call. Do not make promises beyond that.',
      });
    },
  );

  return server;
}
