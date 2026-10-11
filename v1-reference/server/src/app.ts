import { existsSync } from 'node:fs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { handleDialEvent, type DialEvent } from './events.js';
import { callerFromHeaders, maskPhone, safeEqual } from './identity.js';
import { buildMcpServer, type Deps } from './mcp.js';
import { rankQueued, toView } from './queue.js';
import { INTENT_META, VALUE_TIERS, scoreItem } from './scoring.js';
import { verifyDialSignature } from './webhook.js';

export interface AppDeps extends Deps {
  /** Wipe the store and reload seed data (dev only). */
  reseed?: () => Promise<void>;
}

const DONE_VISIBLE_MS = 12 * 3_600_000;

export function createApp(deps: AppDeps): Express {
  const { store, otp, dial, cfg, now, log } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // ───────────────────────── Dial webhooks ─────────────────────────
  // Needs the raw body for signature verification, so no global JSON parser.
  app.post('/webhooks/dial', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

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

    // Answer inside Dial's 10s timeout; do the work (it may fetch the call record) afterwards.
    res.status(200).json({ received: true });
    handleDialEvent(evt, { store, dial, now, log }).catch((err) =>
      log(`event ${evt.type} failed: ${(err as Error).message}`),
    );
  });

  // ───────────────────────── MCP (Dial Context MCP) ─────────────────────────
  const authorizeMcp = (req: Request): boolean => {
    const secret = cfg.mcpSharedSecret;
    if (!secret) return true; // dev only: boot refuses this in production
    const auth = req.header('authorization');
    const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : undefined;
    const provided = req.header('x-mcp-secret') ?? bearer ?? (req.params as Record<string, string>).token;
    return !!provided && safeEqual(provided, secret);
  };

  const mcpPaths = ['/mcp', '/mcp/:token'];

  app.post(mcpPaths, express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
    if (!authorizeMcp(req)) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
      return;
    }
    const ctx = callerFromHeaders((h) => req.header(h));
    const first = Array.isArray(req.body) ? req.body[0] : req.body;
    log(
      `mcp ${first?.method ?? '?'}${first?.params?.name ? ` ${first.params.name}` : ''} ` +
        `caller=${ctx.phone ? maskPhone(ctx.phone, '*') : 'none'} dir=${ctx.direction ?? 'none'}`,
    );

    // Stateless: a fresh server + transport per request, closed over this caller.
    const server = buildMcpServer(ctx, deps);
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
  api.use(express.json());

  api.get('/health', (_req, res) => {
    res.json({
      ok: true,
      store: store.kind,
      dial: dial.mock ? 'mock' : 'live',
      mcpAuth: !!cfg.mcpSharedSecret,
      webhookVerify: !!cfg.dialWebhookSecret,
      time: now(),
    });
  });

  api.get('/config', (_req, res) => {
    res.json({
      orgName: cfg.orgName,
      agingPerMin: cfg.agingPerMin,
      agingCap: cfg.agingCap,
      avgHandleMin: cfg.avgHandleMin,
      repsOnShift: cfg.repsOnShift,
      demoShowCodes: cfg.demoShowCodes,
      enableDev: cfg.enableDev,
      scoring: {
        intents: Object.entries(INTENT_META).map(([intent, m]) => ({ intent, ...m })),
        valueTiers: VALUE_TIERS,
      },
    });
  });

  api.get('/queue', async (_req, res) => {
    const t = now();
    const active = await store.listQueueItems({ statuses: ['queued', 'in_progress'] });
    const queued = rankQueued(active, t, cfg).map((s, i) => toView(s, i + 1));
    const inProgress = active
      .filter((i) => i.status === 'in_progress')
      .sort((a, b) => (b.claimedAt ?? 0) - (a.claimedAt ?? 0))
      .map((item) => toView({ item, score: scoreItem(item, t, cfg) }, null));
    const done = (await store.listQueueItems({ statuses: ['done'], limit: 25 }))
      .filter((i) => (i.doneAt ?? i.createdAt) > t - DONE_VISIBLE_MS)
      .slice(0, 6)
      .map((item) => toView({ item, score: scoreItem(item, t, cfg) }, null));

    const waits = queued.map((q) => q.waitedMin);
    res.json({
      now: t,
      queued,
      inProgress,
      done,
      stats: {
        waiting: queued.length,
        inProgress: inProgress.length,
        longestWaitMin: waits.length ? Math.max(...waits) : 0,
        avgWaitMin: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
      },
    });
  });

  api.get('/queue/:id/transcript', async (req, res) => {
    const item = await store.getQueueItem(String(req.params.id));
    if (!item) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ transcript: item.transcript ?? null, turns: item.transcriptTurns ?? null });
  });

  // The list masks numbers; the full number is only released when a rep claims the item.
  api.post('/queue/:id/callback', async (req, res) => {
    const item = await store.updateQueueItem(String(req.params.id), { status: 'in_progress', claimedAt: now() });
    if (!item) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ phone: item.phone, tel: `tel:${item.phone}` });
  });

  api.post('/queue/:id/done', async (req, res) => {
    const item = await store.updateQueueItem(String(req.params.id), { status: 'done', doneAt: now() });
    if (!item) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ ok: true });
  });

  api.get('/profiles', async (_req, res) => {
    const profiles = await store.listProfiles();
    res.json({
      profiles: profiles.map((p) => ({ name: p.name, phoneMasked: maskPhone(p.phone), createdAt: p.createdAt })),
    });
  });

  // Demo-day fallback if SMS delivery fails on stage: the caller can read the code off the dashboard.
  api.get('/dev/codes', (_req, res) => {
    if (!cfg.demoShowCodes) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      codes: otp.demoCodes().map((c) => ({ phone: c.phone, phoneMasked: maskPhone(c.phone), code: c.code, expiresAt: c.expiresAt })),
    });
  });

  api.post('/dev/reset', async (_req, res) => {
    if (!cfg.enableDev) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    await store.reset();
    await deps.reseed?.();
    res.json({ ok: true });
  });

  app.use('/api', api);

  // Optional single-deploy mode: serve the built dashboard from this server too.
  if (cfg.webDist && existsSync(cfg.webDist)) app.use(express.static(cfg.webDist));

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    log(`unhandled error: ${err.message}`);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
