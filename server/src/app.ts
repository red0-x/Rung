import { createHash } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { waitUntil } from '@vercel/functions';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Auth, AuthUser } from './auth.js';
import type { DialClient, DialLog } from './dial.js';
import { handleDialEvent, type DialEvent } from './events.js';
import { callerFromHeaders, maskPhone, safeEqual } from './identity.js';
import { buildMcpServer, type Deps } from './mcp.js';
import { createOrg, toOrgView } from './orgs.js';
import { loadPromptTemplate, renderPrompt } from './prompt.js';
import { rankQueued, savedMinutes, toView } from './queue.js';
import { HEARTBEAT_MS, repName, repViews } from './reps.js';
import { scoreItem } from './scoring.js';
import { mergeSettings, settingsPatchSchema } from './settings.js';
import type { Org, OrgMember, QueueItem, Role, Trust } from './types.js';
import { verifyDialSignature } from './webhook.js';

export interface AppDeps extends Deps {
  dial: DialClient & { log: DialLog };
  auth: Auth;
  /** Wipe this org's callers/queue and reload its seed data (dev only). */
  reseedOrg?: (org: Org) => Promise<void>;
}

const DONE_VISIBLE_MS = 12 * 3_600_000;
/** A live call that stops updating this long is treated as hung up (no call.ended arrived). */
const LIVE_STALE_MS = 15 * 60_000;
/** After triage_call a live call stays visible this long, so the dashboard can show it moving into the queue. */
const LIVE_HANDOFF_MS = 8_000;
/** /api/callers reads at most this many of the org's newest queue items. */
const CALLERS_ITEM_CAP = 2000;

/** Opaque, stable caller id for the dashboard: never the phone. */
const callerKey = (orgId: string, phone: string) => createHash('sha256').update(`${orgId}:${phone}`).digest('hex').slice(0, 16);
const TIME_SAVED_WINDOW_MS = 24 * 3_600_000;

interface Locals {
  user: AuthUser;
  org: Org | null;
  role: Role | null;
  memberships: OrgMember[];
}
const L = (res: Response) => res.locals as Locals;

const orgBody = z.object({ name: z.string().trim().min(1).max(80) }).strict();
const inviteBody = z
  .object({ email: z.string().trim().toLowerCase().email().max(200), role: z.enum(['admin', 'rep']).default('rep') })
  .strict();
const orgPatchBody = z
  .object({ name: z.string().trim().min(1).max(80).optional(), settings: settingsPatchSchema.optional() })
  .strict();
const numberBody = z.object({ numberId: z.string().min(1) }).strict();

export function createApp(deps: AppDeps): Express {
  const { store, otp, dial, cfg, now, log, auth } = deps;
  // With texted codes off (D6) nothing on the dashboard may claim "verified": old seed/history rows show as recognized.
  const shownTrust = (t: Trust): Trust => (!cfg.requireVerification && t === 'verified' ? 'recognized' : t);
  const view = (...args: Parameters<typeof toView>) => {
    const v = toView(...args);
    return { ...v, trust: shownTrust(v.trust) };
  };
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // ───────────────────────── Dial webhooks ─────────────────────────
  // Needs the raw body for signature verification, so no global JSON parser.
  app.post('/webhooks/dial', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!cfg.dialWebhookSecret && cfg.env === 'production') {
      // Production never accepts unsigned events; the rest of the server runs without the secret.
      res.status(503).json({ error: 'webhook_secret_missing' });
      return;
    }
    if (cfg.dialWebhookSecret) {
      const sig = verifyDialSignature(raw, req.header('x-dial-signature'), cfg.dialWebhookSecret, now());
      if (!sig.ok) {
        log(`webhook rejected: ${sig.reason}`);
        res.status(401).json({ error: sig.reason });
        return;
      }
    }

    let evt: DialEvent;
    try {
      evt = JSON.parse(raw.toString('utf8')) as DialEvent;
    } catch {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }

    // Dial retries non-2xx up to 6 times; dedupe so a retry never double-processes.
    const eventId = req.header('x-dial-event-id') ?? evt.id;
    if (eventId && !(await store.markEventSeen(eventId))) {
      res.status(200).json({ duplicate: true });
      return;
    }

    const work = handleDialEvent(evt, { store, dial, now, log }).catch((err) =>
      log(`event ${evt.type} failed: ${(err as Error).message}`),
    );
    if (cfg.inlineWebhooks) {
      // Serverless: nothing runs after the response, so finish first (Dial allows 10 s; dedupe covers retries).
      await work;
      res.status(200).json({ received: true });
    } else {
      // Long-running server: answer inside Dial's 10 s timeout, then work (it may fetch the call record).
      res.status(200).json({ received: true });
    }
  });

  // ───────────────────────── MCP (Dial Context MCP) ─────────────────────────
  /**
   * Org resolution:
   *  - /mcp/<org.mcp_token>: that org (preferred; the token is the secret).
   *  - /mcp (or /mcp/<MCP_SHARED_SECRET>): org from X-Dial-Agent-Number. Needs MCP_SHARED_SECRET
   *    (URL, X-Mcp-Secret header or bearer) when set; without it, allowed in dev only.
   *    A missing/unsubstituted agent number (tool discovery), or with the secret an unclaimed number,
   *    yields org=null: tools are listed and tool calls answer org_unknown.
   */
  const resolveMcpOrg = async (req: Request): Promise<{ ok: true; org: Org | null } | { ok: false }> => {
    const token = (req.params as Record<string, string | undefined>).token;
    const secret = cfg.mcpSharedSecret;
    if (token) {
      const org = await store.getOrgByMcpToken(token);
      if (org) return { ok: true, org };
      if (!secret || !safeEqual(token, secret)) return { ok: false };
    } else if (secret) {
      const auth = req.header('authorization');
      const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : undefined;
      const provided = req.header('x-mcp-secret') ?? bearer;
      if (!provided || !safeEqual(provided, secret)) return { ok: false };
    } else if (cfg.env === 'production') {
      return { ok: false };
    }
    const agent = callerFromHeaders((h) => req.header(h)).agentNumber;
    if (!agent) return { ok: true, org: null };
    const org = await store.getOrgByDialNumber(agent);
    if (org) return { ok: true, org };
    // With the shared secret the caller is Dial itself: an unclaimed number lists tools, and tool calls
    // answer org_unknown. Without a secret (dev only) an unknown number is refused.
    return secret ? { ok: true, org: null } : { ok: false };
  };

  const mcpPaths = ['/mcp', '/mcp/:token'];

  app.post(mcpPaths, express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
    const resolved = await resolveMcpOrg(req);
    if (!resolved.ok) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
      return;
    }
    const ctx = callerFromHeaders((h) => req.header(h));
    const first = Array.isArray(req.body) ? req.body[0] : req.body;
    log(
      `mcp [${resolved.org?.slug ?? 'no-org'}] ${first?.method ?? '?'}${first?.params?.name ? ` ${first.params.name}` : ''} ` +
        `caller=${ctx.phone ? maskPhone(ctx.phone, '*') : 'none'} dir=${ctx.direction ?? 'none'}`,
    );

    // Stateless: a fresh server + transport per request, closed over this org and caller.
    const server = buildMcpServer(resolved.org, ctx, deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log(`mcp error: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  app.all(mcpPaths, (_req, res) => {
    res
      .status(405)
      .set('Allow', 'POST')
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  });

  // ───────────────────────── Dashboard API ─────────────────────────
  const api = express.Router();
  api.use(cors({ origin: cfg.corsOrigin === '*' ? true : cfg.corsOrigin.split(',').map((s) => s.trim()) }));
  api.use(express.json({ limit: '256kb' }));

  api.get('/health', (_req, res) => {
    res.json({
      ok: true,
      store: store.kind,
      dial: dial.mock ? 'mock' : 'live',
      webhookVerify: !!cfg.dialWebhookSecret,
      mcpAuth: !!cfg.mcpSharedSecret,
      keewano: deps.keewano ? deps.keewano.stats() : { enabled: false },
      time: now(),
    });
  });

  // Everything below needs a signed-in user.
  api.use(async (req, res, next) => {
    const h = req.header('authorization') ?? '';
    const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
    const user = token ? await auth.verify(token).catch(() => null) : null;
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    let memberships = await store.listMemberships(user.id);
    // Invites by email turn into memberships when the person loads the app (after they sign up).
    if (req.path === '/me' && user.email) {
      const pending = (await store.listInvitesForEmail(user.email)).filter((i) => !memberships.some((m) => m.orgId === i.orgId));
      for (const i of pending) await store.addMember({ orgId: i.orgId, userId: user.id, role: i.role });
      if (pending.length) {
        log(`invites accepted by ${user.email}: ${pending.length}`);
        memberships = await store.listMemberships(user.id);
      }
    }
    // One login can belong to several orgs: the dashboard names one per request, else the oldest membership.
    const wanted = req.header('x-org-id');
    const m = memberships.find((x) => x.orgId === wanted) ?? memberships[0];
    const org = m ? ((await store.getOrg(m.orgId)) ?? null) : null;
    // Presence heartbeat (throttled): any signed-in request means this rep has the dashboard open.
    const t = now();
    if (m && org && (m.lastSeenAt === undefined || t - m.lastSeenAt > HEARTBEAT_MS)) {
      await store.touchMember(org.id, user.id, t, repName(user.email));
    }
    Object.assign(res.locals, { user, org, role: org ? m!.role : null, memberships } satisfies Locals);
    next();
  });

  const platform = () => ({
    dial: dial.mock ? 'mock' : 'live',
    demoShowCodes: cfg.demoShowCodes && cfg.requireVerification,
    enableDev: cfg.enableDev,
    requireVerification: cfg.requireVerification,
  });

  api.get('/me', async (_req, res) => {
    const { user, org, role, memberships } = L(res);
    const orgs = (await Promise.all(memberships.map(async (m) => ({ m, o: await store.getOrg(m.orgId) }))))
      .filter((x) => x.o)
      .map(({ m, o }) => ({ id: o!.id, name: o!.name, slug: o!.slug, role: m.role }));
    res.json({ user: { id: user.id, email: user.email }, org: org ? toOrgView(cfg, org) : null, role, orgs, platform: platform() });
  });

  api.post('/org', async (req, res) => {
    const { user, org: existing } = L(res);
    if (existing) {
      res.status(409).json({ error: 'already_member' });
      return;
    }
    const body = orgBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid', message: body.error.message });
      return;
    }
    const org = await createOrg(store, { name: body.data.name, now: now() });
    await store.addMember({ orgId: org.id, userId: user.id, role: 'admin' });
    log(`org created: ${org.slug}`);
    res.status(201).json({ org: toOrgView(cfg, org) });
  });

  // Everything below needs an org.
  api.use((_req, res, next) => {
    if (!L(res).org) {
      res.status(403).json({ error: 'no_org' });
      return;
    }
    next();
  });
  const orgOf = (res: Response) => L(res).org!;

  /** Add a teammate by email (admin). They join on their next sign-in; an existing account joins on its next page load. */
  api.post('/org/invites', async (req, res) => {
    if (L(res).role !== 'admin') {
      res.status(403).json({ error: 'admin_only' });
      return;
    }
    const body = inviteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid', message: body.error.message });
      return;
    }
    await store.addInvite({ orgId: orgOf(res).id, email: body.data.email, role: body.data.role, createdAt: now() });
    log(`[${orgOf(res).slug}] invited ${body.data.email} as ${body.data.role}`);
    res.status(201).json({ ok: true });
  });

  api.get('/org', (_req, res) => {
    res.json({ org: toOrgView(cfg, orgOf(res)) });
  });

  api.patch('/org', async (req, res) => {
    const org = orgOf(res);
    const body = orgPatchBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid', message: body.error.message });
      return;
    }
    const patch: Partial<Org> = {};
    if (body.data.name) patch.name = body.data.name;
    if (body.data.settings) patch.settings = mergeSettings(org.settings, body.data.settings);
    const next = Object.keys(patch).length ? await store.updateOrg(org.id, patch) : org;
    res.json({ org: toOrgView(cfg, next ?? org) });
  });

  api.get('/numbers', async (_req, res) => {
    const org = orgOf(res);
    const claimed = new Map((await store.listOrgs()).filter((o) => o.dialNumberId).map((o) => [o.dialNumberId!, o.id]));
    res.json({
      numbers: cfg.numberPool.map((n) => {
        const owner = claimed.get(n.id);
        return { id: n.id, number: n.number, mock: n.mock, available: !owner, mine: owner === org.id };
      }),
    });
  });

  api.post('/org/number', async (req, res) => {
    const org = orgOf(res);
    const body = numberBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid', message: body.error.message });
      return;
    }
    const n = cfg.numberPool.find((p) => p.id === body.data.numberId);
    if (!n) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const owner = (await store.listOrgs()).find((o) => o.dialNumberId === n.id || o.dialNumber === n.number);
    if (owner && owner.id !== org.id) {
      res.status(409).json({ error: 'number_taken' });
      return;
    }
    // Claiming a new number releases the old one (a number belongs to one org at a time).
    let next: Org | undefined;
    try {
      next = await store.updateOrg(org.id, { dialNumber: n.number, dialNumberId: n.id, publishedAt: null });
    } catch {
      res.status(409).json({ error: 'number_taken' });
      return;
    }
    log(`[${org.slug}] claimed ${n.number} (${n.id})`);
    res.json({ org: toOrgView(cfg, next ?? org) });
  });

  const render = (name: string, settings: Org['settings']) =>
    renderPrompt(loadPromptTemplate(cfg.promptTemplatePath), name, settings, { require_verification: cfg.requireVerification });

  api.get('/prompt-preview', (_req, res) => {
    const org = orgOf(res);
    res.json({ prompt: render(org.name, org.settings) });
  });

  api.post('/prompt-preview', (req, res) => {
    const org = orgOf(res);
    const body = orgPatchBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: 'invalid', message: body.error.message });
      return;
    }
    const settings = body.data.settings ? mergeSettings(org.settings, body.data.settings) : org.settings;
    res.json({ prompt: render(body.data.name ?? org.name, settings) });
  });

  api.post('/org/publish', async (_req, res) => {
    const org = orgOf(res);
    if (!org.dialNumberId || !org.dialNumber) {
      res.status(400).json({ error: 'no_number', message: 'Claim a number first.' });
      return;
    }
    const inboundInstruction = render(org.name, org.settings);
    const pooled = cfg.numberPool.find((p) => p.id === org.dialNumberId);
    const mock = dial.mock || !!pooled?.mock;
    try {
      if (mock && !dial.mock) {
        // Live Dial, but a fake pool number: record it, don't send it to Dial.
        dial.log.patches.push({ orgId: org.id, numberId: org.dialNumberId, inboundInstruction, at: now() });
      } else {
        await dial.updateNumberInstruction(org.dialNumberId, inboundInstruction, { orgId: org.id });
      }
    } catch (err) {
      log(`[${org.slug}] publish failed: ${(err as Error).message}`);
      res.status(502).json({ error: 'dial_failed', message: (err as Error).message });
      return;
    }
    await store.updateOrg(org.id, { publishedAt: now() });
    log(`[${org.slug}] published prompt to ${org.dialNumber}${mock ? ' (mock)' : ''}`);
    res.json({
      ok: true,
      mock,
      numberId: org.dialNumberId,
      number: org.dialNumber,
      request: { method: 'PATCH', path: `/numbers/${org.dialNumberId}`, body: { inboundInstruction } },
    });
  });

  api.get('/queue', async (_req, res) => {
    const org = orgOf(res);
    const s = org.settings;
    const t = now();
    const [active, doneList, today, members, liveCalls] = await Promise.all([
      store.listQueueItems(org.id, { statuses: ['queued', 'in_progress'] }),
      store.listQueueItems(org.id, { statuses: ['done'], since: t - DONE_VISIBLE_MS - 24 * 3_600_000, limit: 50 }),
      store.listQueueItems(org.id, { since: t - TIME_SAVED_WINDOW_MS }),
      store.listMembers(org.id),
      // Display only: a missing live_calls table (migration not applied) must not break the queue.
      store.listLiveCalls(org.id, t - LIVE_STALE_MS, t - LIVE_HANDOFF_MS).catch((err) => {
        log(`[${org.slug}] live calls: ${(err as Error).message}`);
        return [];
      }),
    ]);
    const reps = repViews(members, active.filter((i) => i.status === 'in_progress'), t);
    const queued = rankQueued(active, t, s).map((x, i) => view(x, i + 1, s));
    const inProgress = active
      .filter((i) => i.status === 'in_progress')
      .sort((a, b) => (b.claimedAt ?? 0) - (a.claimedAt ?? 0))
      .map((item) => view({ item, score: scoreItem(item, t, s) }, null, s));
    const done = doneList
      .filter((i) => (i.doneAt ?? i.createdAt) > t - DONE_VISIBLE_MS)
      .sort((a, b) => (b.doneAt ?? b.createdAt) - (a.doneAt ?? a.createdAt))
      .slice(0, 6)
      .map((item) => view({ item, score: scoreItem(item, t, s) }, null, s));

    const waits = queued.map((q) => q.waitedMin);
    const returningCallers = today.filter((i) => i.returning).length;
    res.json({
      now: t,
      queued,
      inProgress,
      done,
      live: liveCalls.map((c) => ({
        key: callerKey(org.id, c.phone),
        name: c.name ?? null,
        phoneMasked: maskPhone(c.phone),
        known: c.known,
        stage: c.stage,
        startedAt: c.startedAt,
        queuedAt: c.queuedAt ?? null,
      })),
      stats: {
        waiting: queued.length,
        inProgress: inProgress.length,
        longestWaitMin: waits.length ? Math.max(...waits) : 0,
        avgWaitMin: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
      },
      me: L(res).user.id,
      reps,
      availableReps: reps.filter((r) => r.online && !r.busy).length,
      timeSaved: {
        totalMin: today.reduce((sum, i) => sum + savedMinutes(i, s), 0),
        callers: today.length,
        baselineHoldMin: s.baselineHoldMin,
        reexplainMin: s.reexplainMin,
        returningCallers,
        formula: `${s.baselineHoldMin} min hold avoided per caller + ${s.reexplainMin} min re-explaining avoided per returning caller`,
      },
    });
  });

  /** An id from another org is indistinguishable from an unknown id. */
  const ownItem = async (res: Response, id: string): Promise<QueueItem | undefined> => {
    const item = await store.getQueueItem(id);
    if (!item || item.orgId !== orgOf(res).id) {
      res.status(404).json({ error: 'not_found' });
      return undefined;
    }
    return item;
  };

  api.get('/queue/:id/transcript', async (req, res) => {
    const item = await ownItem(res, String(req.params.id));
    if (!item) return;
    res.json({ transcript: item.transcript ?? null, turns: item.transcriptTurns ?? null });
  });

  /** The rep's own claim fields, set together on every claim. */
  const claimBy = (res: Response) => {
    const { user } = L(res);
    return { status: 'in_progress' as const, claimedAt: now(), claimedBy: user.id, claimedByName: repName(user.email) };
  };
  const unclaimed = { claimedAt: undefined, claimedBy: undefined, claimedByName: undefined };
  const phoneOf = (item: QueueItem) => ({ phone: item.phone, tel: `tel:${item.phone}` });
  const trackCallback = (res: Response, item: QueueItem) => {
    const org = orgOf(res);
    deps.keewano?.track('callback_made', org.slug, item.phone, scoreItem(item, now(), org.settings).tier);
    if (cfg.inlineWebhooks && deps.keewano) waitUntil(deps.keewano.flush().catch(() => {}));
  };

  /** Someone else's callback: only they or an admin may finish or cancel it. Unowned (pre-multi-rep) items are fair game. */
  const othersClaim = (res: Response, item: QueueItem) => {
    const { user, role } = L(res);
    if (item.status !== 'in_progress' || !item.claimedBy || item.claimedBy === user.id || role === 'admin') return false;
    res.status(403).json({ error: 'not_claimer', claimedBy: { id: item.claimedBy, name: item.claimedByName ?? 'Rep' } });
    return true;
  };

  // The list masks numbers; the full number is only released when a rep claims the item.
  // The claim is compare-and-set on status, so two reps clicking the same caller can't both get the number.
  api.post('/queue/:id/callback', async (req, res) => {
    const item = await ownItem(res, String(req.params.id));
    if (!item) return;
    if (item.status === 'in_progress' && item.claimedBy === L(res).user.id) {
      res.json(phoneOf(item)); // re-dial your own claim
      return;
    }
    const claimed = item.status === 'queued' ? await store.updateQueueItemIf(item.id, 'queued', claimBy(res)) : undefined;
    if (!claimed) {
      const cur = (await store.getQueueItem(item.id)) ?? item;
      res.status(409).json(
        cur.status === 'in_progress'
          ? { error: 'already_claimed', claimedBy: cur.claimedBy ? { id: cur.claimedBy, name: cur.claimedByName ?? 'Rep' } : null }
          : { error: 'not_queued' },
      );
      return;
    }
    trackCallback(res, claimed);
    log(`[${orgOf(res).slug}] callback claimed ${item.id} by ${L(res).user.email}`);
    res.json(phoneOf(claimed));
  });

  /** Take next: claim the top-ranked unclaimed caller. One open callback per rep; 204 when nobody is waiting. */
  api.post('/queue/next', async (_req, res) => {
    const org = orgOf(res);
    const me = L(res).user.id;
    const active = await store.listQueueItems(org.id, { statuses: ['queued', 'in_progress'] });
    const mine = active.find((i) => i.status === 'in_progress' && i.claimedBy === me);
    if (mine) {
      res.status(409).json({ error: 'at_capacity', id: mine.id });
      return;
    }
    // Lost a race for the top caller? Try the next one down.
    for (const candidate of rankQueued(active, now(), org.settings)) {
      const claimed = await store.updateQueueItemIf(candidate.item.id, 'queued', claimBy(res));
      if (!claimed) continue;
      trackCallback(res, claimed);
      log(`[${org.slug}] next -> ${claimed.id} for ${L(res).user.email}`);
      res.json({ item: view({ item: claimed, score: scoreItem(claimed, now(), org.settings) }, null, org.settings), ...phoneOf(claimed) });
      return;
    }
    res.status(204).end();
  });

  api.post('/queue/:id/done', async (req, res) => {
    const item = await ownItem(res, String(req.params.id));
    if (!item || othersClaim(res, item)) return;
    await store.updateQueueItem(item.id, { status: 'done', doneAt: now() });
    const org = orgOf(res);
    deps.keewano?.track('call_done', org.slug, item.phone, scoreItem(item, now(), org.settings).tier);
    if (cfg.inlineWebhooks && deps.keewano) waitUntil(deps.keewano.flush().catch(() => {}));
    res.json({ ok: true });
  });

  /** Cancel a callback: back in line with the original createdAt, so rank and aging resume. */
  api.post('/queue/:id/release', async (req, res) => {
    const item = await ownItem(res, String(req.params.id));
    if (!item) return;
    if (item.status !== 'in_progress') {
      res.status(409).json({ error: 'not_in_progress' });
      return;
    }
    if (othersClaim(res, item)) return;
    await store.updateQueueItem(item.id, { status: 'queued', ...unclaimed });
    log(`[${orgOf(res).slug}] callback released ${item.id}`);
    res.json({ ok: true });
  });

  /** Undo Done: back in line with the original createdAt. */
  api.post('/queue/:id/reopen', async (req, res) => {
    const item = await ownItem(res, String(req.params.id));
    if (!item) return;
    if (item.status !== 'done') {
      res.status(409).json({ error: 'not_done' });
      return;
    }
    await store.updateQueueItem(item.id, { status: 'queued', doneAt: undefined, ...unclaimed });
    log(`[${orgOf(res).slug}] reopened ${item.id}`);
    res.json({ ok: true });
  });

  /** Everyone with a profile or any request at this org. Two queries, merged in memory (capped for demo-sized data). */
  api.get('/callers', async (_req, res) => {
    const org = orgOf(res);
    const s = org.settings;
    const [profiles, items] = await Promise.all([
      store.listProfiles(org.id),
      store.listQueueItems(org.id, { limit: CALLERS_ITEM_CAP }), // newest first
    ]);
    const byPhone = new Map<string, QueueItem[]>();
    for (const i of items) {
      const list = byPhone.get(i.phone);
      if (list) list.push(i);
      else byPhone.set(i.phone, [i]);
    }
    const profileByPhone = new Map(profiles.map((p) => [p.phone, p]));
    const phones = new Set([...profileByPhone.keys(), ...byPhone.keys()]);
    const rows = [...phones].map((phone) => {
      const p = profileByPhone.get(phone);
      const list = byPhone.get(phone) ?? [];
      const last = list[0];
      const open = list.find((i) => i.status === 'queued' || i.status === 'in_progress');
      const meta = last ? s.intents[last.intent] : undefined;
      const row = {
        key: callerKey(org.id, phone),
        name: p?.name ?? list.find((i) => i.name)?.name ?? null,
        phoneMasked: maskPhone(phone),
        saved: !!p,
        trust: shownTrust((p ? (p.verifiedAt ? 'verified' : 'recognized') : 'new') as Trust),
        callCount: list.length,
        lastCallAt: last?.createdAt ?? null,
        lastIntentLabel: meta?.label ?? null,
        lastTier: meta?.tier ?? null,
        lastSummary: last?.summary ?? null,
        lastAmountUsd: last?.amountUsd ?? null,
        openStatus: (open?.status ?? null) as 'queued' | 'in_progress' | null,
      };
      return { row, activity: Math.max(last?.createdAt ?? 0, p?.createdAt ?? 0) };
    });
    rows.sort((a, b) => b.activity - a.activity);
    res.json({ callers: rows.map((r) => r.row) });
  });

  api.get('/history', async (req, res) => {
    const org = orgOf(res);
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw) && raw >= 1 ? Math.min(200, Math.floor(raw)) : 50;
    const t = now();
    const items = await store.listQueueItems(org.id, { statuses: ['done'], orderBy: 'doneAt', limit });
    res.json({ items: items.map((item) => view({ item, score: scoreItem(item, t, org.settings) }, null, org.settings)) });
  });

  /** Keewano-powered plain-English stats for this org. Cached; ?refresh=1 re-asks (rate limited). Always 200. */
  api.get('/insights', async (req, res) => {
    const k = deps.keewano;
    if (!k) {
      res.json({ enabled: false, asOf: null, stale: false, items: [], note: 'Keewano is not configured.' });
      return;
    }
    try {
      res.json(await k.insights(orgOf(res).slug, { refresh: req.query.refresh === '1' }));
    } catch (err) {
      log(`insights failed: ${(err as Error).message}`);
      res.json({ enabled: true, asOf: null, stale: true, items: [], note: 'Insights are unavailable right now.' });
    }
  });

  /**
   * Forget a caller (admin): this org's profile, texted-code state and every request from the number, transcripts included.
   * Their next call is a first call. Addressed by the opaque row key from /callers so no number travels in the URL.
   */
  api.delete('/callers/:key', async (req, res) => {
    if (L(res).role !== 'admin') {
      res.status(403).json({ error: 'admin_only' });
      return;
    }
    const org = orgOf(res);
    const [profiles, items] = await Promise.all([store.listProfiles(org.id), store.listQueueItems(org.id)]);
    const phone = [...new Set([...profiles.map((p) => p.phone), ...items.map((i) => i.phone)])].find(
      (ph) => callerKey(org.id, ph) === req.params.key,
    );
    if (!phone) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const removed = await store.forgetCaller(org.id, phone);
    log(`[${org.slug}] forgot caller ${maskPhone(phone)} (profile=${removed.profile}, items=${removed.items}) by ${L(res).user.email}`);
    res.json({ ok: true, removed });
  });

  api.get('/profiles', async (_req, res) => {
    const profiles = await store.listProfiles(orgOf(res).id);
    res.json({
      profiles: profiles.map((p) => ({
        name: p.name,
        phoneMasked: maskPhone(p.phone),
        createdAt: p.createdAt,
        verified: !!p.verifiedAt,
      })),
    });
  });

  // Demo-day fallback if SMS delivery fails on stage: the caller can read the code off the dashboard.
  api.get('/dev/codes', (_req, res) => {
    if (!cfg.demoShowCodes || !cfg.requireVerification) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      codes: otp.demoCodes(orgOf(res).id).map((c) => ({ phoneMasked: maskPhone(c.phone), code: c.code, expiresAt: c.expiresAt })),
    });
  });

  api.get('/dev/dial-log', (_req, res) => {
    const orgId = orgOf(res).id;
    const mine = <T extends { orgId: string | null }>(list: T[]) => list.filter((x) => x.orgId === orgId);
    res.json({
      mock: dial.mock,
      sms: mine(dial.log.sms).map((m) => ({ toMasked: maskPhone(m.to), from: m.from, body: m.body, at: m.at })),
      patches: mine(dial.log.patches).map((p) => ({ numberId: p.numberId, at: p.at, inboundInstruction: p.inboundInstruction })),
      callFetches: mine(dial.log.callFetches).map((c) => ({ callId: c.callId, at: c.at })),
    });
  });

  api.post('/dev/reset', async (_req, res) => {
    if (!cfg.enableDev) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const org = orgOf(res);
    if (deps.reseedOrg) await deps.reseedOrg(org);
    else await store.resetOrgData(org.id);
    otp.clearDemoCodes(org.id);
    log(`[${org.slug}] reset`);
    res.json({ ok: true });
  });

  app.use('/api', api);

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    log(`unhandled error: ${err.message}`);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
