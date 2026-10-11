import { createHmac, randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Keewano analytics for Rung: call funnel events out, plain-English Insights back.
 *
 * Events use Keewano's built-in event types (no custom-event registration). Keewano SQL can group and count
 * text values but not parse them, so `data` is ONE short token: rung_<event>[_<qualifier>]_<orgkey>.
 * The org key keeps each company's numbers separate. Callers are identified only by an HMAC-derived UUID:
 * no phone number, name, or exact dollar amount is ever sent. Analytics never blocks or fails a call.
 */

export type KeewanoEvent =
  | 'call_started' // qualifier: known | new
  | 'code_sent'
  | 'code_verified'
  | 'code_failed'
  | 'profile_saved'
  | 'context_saved' // caller facts stored (update_profile or save_profile.facts); qualifier: n fields
  | 'eta_text' // callback ETA text; qualifier: sent | failed | skipped
  | 'call_queued' // qualifier: critical | high | normal | low
  | 'callback_made' // qualifier: tier
  | 'call_done'; // qualifier: tier

/** Built-in Keewano event type ids (all take a string payload). */
export const EVENT_TYPE: Record<KeewanoEvent, number> = {
  call_started: 16, // Scene Loaded
  code_sent: 50, // Onboarding Milestone
  code_verified: 50,
  code_failed: 50,
  profile_saved: 50,
  context_saved: 50,
  eta_text: 50,
  call_queued: 22, // Window Open
  callback_made: 20, // Button Click
  call_done: 20,
};

const TIERS = ['critical', 'high', 'normal', 'low'] as const;

export interface Keewano {
  readonly enabled: boolean;
  track(event: KeewanoEvent, orgSlug: string, phone: string, qualifier?: string): void;
  flush(): Promise<void>;
  insights(orgSlug: string, opts?: { refresh?: boolean }): Promise<InsightsView>;
  stats(): { enabled: boolean; insights: boolean; queued: number; sent: number; failed: number; lastError?: string };
}

export const clean = (v: string, max: number): string =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);

export const orgKey = (slug: string): string => clean(slug, 14) || 'org';

export function encodeData(event: KeewanoEvent, org: string, qualifier?: string): string {
  const q = qualifier ? clean(qualifier, 16) : '';
  return `rung_${event}${q ? `_${q}` : ''}_${orgKey(org)}`.slice(0, 64);
}

/** Stable pseudonymous UUID for one (org, phone). */
export function installIdFor(secret: string, org: string, phone: string): string {
  const h = createHmac('sha256', secret).update(`keewano:${orgKey(org)}:${phone}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x80;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export const noopKeewano: Keewano = {
  enabled: false,
  track() {},
  async flush() {},
  async insights() {
    return { enabled: false, asOf: null, stale: false, items: [], note: 'Set KEEWANO_ACCESS_TOKEN to turn on Keewano insights.' };
  },
  stats: () => ({ enabled: false, insights: false, queued: 0, sent: 0, failed: 0 }),
};

// ───────────────────────── Insights ─────────────────────────

// Both sides bounded because event times are sender-supplied.
const WINDOW = "event_datetime >= now() - INTERVAL '24 hours' AND event_datetime <= now() + INTERVAL '1 hour'";

export interface SqlResult {
  columns: string[];
  rows: string[][];
}

const num = (v: unknown): number => Number(v) || 0;

function inList(event: KeewanoEvent, org: string, qualifiers: readonly string[]): string {
  return qualifiers.map((q) => `'${encodeData(event, org, q)}'`).join(', ');
}

/** Row label back from a token: rung_call_queued_critical_bank -> critical */
function label(token: string, event: KeewanoEvent, org: string): string {
  const prefix = `rung_${event}_`;
  const suffix = `_${orgKey(org)}`;
  let s = String(token ?? '');
  if (s.startsWith(prefix)) s = s.slice(prefix.length);
  if (s.endsWith(suffix)) s = s.slice(0, -suffix.length);
  return s.replace(/_/g, ' ') || 'unknown';
}

function grouped(event: KeewanoEvent, org: string, empty: string) {
  return (r: SqlResult): string =>
    r.rows.length ? r.rows.map((row) => `${label(row[0] ?? '', event, org)} ${num(row[1])}`).join(' · ') : empty;
}

export function queriesFor(org: string): Array<{ id: string; title: string; sql: string; format: (r: SqlResult) => string }> {
  return [
    {
      id: 'queued_by_urgency',
      title: 'Calls queued in the last 24 h, by urgency',
      sql: `SELECT "Window Open" AS kind, count("Window Open") AS n FROM events WHERE "Window Open" IN (${inList('call_queued', org, TIERS)}) AND ${WINDOW} GROUP BY kind ORDER BY n DESC LIMIT 8`,
      format: grouped('call_queued', org, 'No calls queued yet'),
    },
    {
      id: 'callers',
      title: 'Returning vs new callers',
      sql: `SELECT "Scene Loaded" AS kind, count("Scene Loaded") AS n FROM events WHERE "Scene Loaded" IN (${inList('call_started', org, ['known', 'new'])}) AND ${WINDOW} GROUP BY kind ORDER BY n DESC LIMIT 4`,
      format: grouped('call_started', org, 'No calls yet'),
    },
    {
      id: 'callbacks_made',
      title: 'Callbacks made, by urgency',
      sql: `SELECT "Button Click" AS kind, count("Button Click") AS n FROM events WHERE "Button Click" IN (${inList('callback_made', org, TIERS)}) AND ${WINDOW} GROUP BY kind ORDER BY n DESC LIMIT 8`,
      format: grouped('callback_made', org, 'No callbacks yet'),
    },
    {
      id: 'context_saved',
      title: 'Caller details remembered (last 24 h)',
      sql: `SELECT "Onboarding Milestone" AS kind, count("Onboarding Milestone") AS n FROM events WHERE "Onboarding Milestone" IN (${inList('context_saved', org, ['1', '2', '3', '4', '5', '6', '7'])}) AND ${WINDOW} GROUP BY kind ORDER BY n DESC LIMIT 8`,
      format: (r) => {
        const total = r.rows.reduce((s, row) => s + num(row[1]), 0);
        return total ? `${total} callers had details saved for next time` : 'No details saved yet';
      },
    },
    {
      id: 'eta_text',
      title: 'Callback time texts (last 24 h)',
      sql: `SELECT "Onboarding Milestone" AS kind, count("Onboarding Milestone") AS n FROM events WHERE "Onboarding Milestone" IN (${inList('eta_text', org, ['sent', 'failed', 'skipped'])}) AND ${WINDOW} GROUP BY kind ORDER BY n DESC LIMIT 4`,
      format: grouped('eta_text', org, 'No texts yet'),
    },
  ];
}

export interface InsightItem {
  id: string;
  title: string;
  answer: string | null;
  error?: string;
}

export interface InsightsView {
  enabled: boolean;
  asOf: string | null;
  stale: boolean;
  items: InsightItem[];
  note?: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
export const cleanAnswer = (t: string): string => t.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, 600);

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** run_sql_query answers with text: "SQL result for project X: 2 row(s), 2 column(s).\nkind,n\nrow\n..." */
export function parseSqlResult(text: string): SqlResult {
  const m = text.match(/\d+ row\(s\), \d+ column\(s\)\.?[^\S\r\n]*\r?\n([\s\S]*)$/);
  if (m) {
    const lines = m[1]!.split(/\r?\n/).filter((l) => l.trim() !== '');
    const header = lines.length ? splitCsvLine(lines[0]!) : [];
    const rows = lines.slice(1).filter((l) => !/^\(.*(truncated|more row).*\)$/i.test(l.trim())).map(splitCsvLine);
    return { columns: header, rows };
  }
  if (/\b0 row\(s\)/.test(text)) return { columns: [], rows: [] };
  throw new Error(`Keewano returned something unexpected: ${cleanAnswer(text).slice(0, 120)}`);
}

export function mcpText(result: unknown): string {
  const r = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean } | undefined;
  const text = (r?.content ?? []).filter((c) => c.type === 'text' && typeof c.text === 'string').map((c) => c.text as string).join('\n');
  if (r?.isError) throw new Error(`Keewano could not answer: ${cleanAnswer(text) || 'unknown error'}`.slice(0, 300));
  return text;
}

// ───────────────────────── Client ─────────────────────────

export interface KeewanoOptions {
  sdkKey?: string;
  accessToken?: string;
  projectId?: string;
  apiUrl: string;
  hashSecret: string;
  /** Max Keewano MCP questions per UTC day; 0 = unlimited (after #SpeedHacks). */
  dailyLimit: number;
  ttlMs: number;
  minRefreshMs?: number;
  now?: () => number;
  log?: (m: string) => void;
  fetchImpl?: typeof fetch;
  /** Run a SQL query. Default: Keewano MCP. Tests replace it. */
  runSql?: (projectId: string | undefined, sql: string) => Promise<string>;
}

interface Pending {
  installId: string;
  eventTypeId: number;
  timestamp: number;
  data: string;
}

export class KeewanoClient implements Keewano {
  private queue: Pending[] = [];
  private sent = 0;
  private failed = 0;
  private lastError?: string;
  private timer?: NodeJS.Timeout;
  private flushing?: Promise<void>;
  private cache = new Map<string, { at: number; items: InsightItem[] }>();
  private inflight = new Map<string, Promise<InsightsView>>();
  private quota = { day: '', used: 0 };
  private projectId?: string;
  private readonly now: () => number;
  private readonly f: typeof fetch;

  constructor(private readonly o: KeewanoOptions) {
    this.now = o.now ?? Date.now;
    this.f = o.fetchImpl ?? fetch;
    this.projectId = o.projectId;
  }

  get enabled(): boolean {
    return Boolean(this.o.sdkKey);
  }

  track(event: KeewanoEvent, orgSlug: string, phone: string, qualifier?: string): void {
    if (!this.enabled) return;
    try {
      if (this.queue.length >= 500) this.queue.shift();
      this.queue.push({
        installId: installIdFor(this.o.hashSecret, orgSlug, phone),
        eventTypeId: EVENT_TYPE[event],
        timestamp: Math.floor(this.now() / 1000),
        data: encodeData(event, orgSlug, qualifier),
      });
      if (this.queue.length >= 20) void this.flush();
      else if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.flush();
        }, 2000);
        this.timer.unref?.();
      }
    } catch (err) {
      this.note(err);
    }
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.flushing = this.drain().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async drain(): Promise<void> {
    const batch = this.queue.splice(0, this.queue.length);
    const groups = new Map<string, Pending[]>();
    for (const e of batch) groups.set(e.installId, [...(groups.get(e.installId) ?? []), e]);
    await Promise.all(
      [...groups].map(async ([installId, events]) => {
        try {
          const res = await this.f(`${this.o.apiUrl}/event/ingress/v1/json/in`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'k-token': this.o.sdkKey! },
            body: JSON.stringify({
              dataSessionId: randomUUID(),
              batch: 1,
              customEventsHash: 0,
              installId,
              events: events.map(({ eventTypeId, timestamp, data }) => ({ eventTypeId, timestamp, data })),
            }),
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) throw new Error(`Keewano ingest HTTP ${res.status}`);
          this.sent += events.length;
        } catch (err) {
          this.failed += events.length;
          this.note(err);
        }
      }),
    );
  }

  private note(err: unknown): void {
    this.lastError = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    this.o.log?.(`keewano: ${this.lastError} (calls are unaffected)`);
  }

  stats() {
    return {
      enabled: this.enabled,
      insights: Boolean(this.o.accessToken),
      queued: this.queue.length,
      sent: this.sent,
      failed: this.failed,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  // Insights ----------------------------------------------------

  private consume(): boolean {
    if (this.o.dailyLimit <= 0) return true;
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (this.quota.day !== day) this.quota = { day, used: 0 };
    if (this.quota.used >= this.o.dailyLimit) return false;
    this.quota.used++;
    return true;
  }

  private view(items: InsightItem[], at: number, stale: boolean, note?: string): InsightsView {
    return { enabled: true, asOf: new Date(at).toISOString(), stale, items, ...(note ? { note } : {}) };
  }

  async insights(orgSlug: string, options: { refresh?: boolean } = {}): Promise<InsightsView> {
    if (!this.o.accessToken && !this.o.runSql) return noopKeewano.insights(orgSlug);
    const key = orgKey(orgSlug);
    const cached = this.cache.get(key);
    const age = cached ? this.now() - cached.at : Infinity;
    const refreshOk = options.refresh === true && age >= (this.o.minRefreshMs ?? 60_000);
    if (cached && age < this.o.ttlMs && !refreshOk) return this.view(cached.items, cached.at, false);
    let p = this.inflight.get(key);
    if (!p) {
      p = this.refresh(orgSlug).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  private async sql(sql: string): Promise<string> {
    if (this.o.runSql) return this.o.runSql(this.projectId, sql);
    const client = new Client({ name: 'rung-insights', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${this.o.apiUrl}/mcp`), {
      requestInit: { headers: { 'k-token': this.o.accessToken! } },
    });
    try {
      await client.connect(transport);
      if (!this.projectId) {
        const t = mcpText(await client.callTool({ name: 'list_projects', arguments: {} }));
        const id = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
        if (!id) throw new Error('No Keewano project found for this token');
        this.projectId = id;
      }
      return mcpText(await client.callTool({ name: 'run_sql_query', arguments: { projectId: this.projectId, sqlQuery: sql, maxRows: 20 } }));
    } finally {
      await client.close().catch(() => {});
    }
  }

  private async refresh(orgSlug: string): Promise<InsightsView> {
    const key = orgKey(orgSlug);
    const prev = new Map((this.cache.get(key)?.items ?? []).map((i) => [i.id, i]));
    const items: InsightItem[] = [];
    let anyOk = false;
    let note: string | undefined;
    for (const q of queriesFor(orgSlug)) {
      const old = prev.get(q.id);
      if (!this.consume()) {
        note = `Keewano daily question limit reached (${this.o.dailyLimit}). Send #SpeedHacks in Keewano's chat, then set KEEWANO_MCP_DAILY_LIMIT=0.`;
        items.push({ id: q.id, title: q.title, answer: old?.answer ?? null, error: 'Daily limit reached' });
        continue;
      }
      try {
        const result = parseSqlResult(await this.sql(q.sql));
        items.push({ id: q.id, title: q.title, answer: cleanAnswer(q.format(result)) });
        anyOk = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.o.log?.(`keewano insights ${q.id}: ${cleanAnswer(msg).slice(0, 160)}`);
        items.push({ id: q.id, title: q.title, answer: old?.answer ?? null, error: cleanAnswer(msg).slice(0, 200) });
      }
    }
    const at = this.now();
    const cached = this.cache.get(key);
    if (!anyOk && cached) return this.view(cached.items, cached.at, true, note ?? 'Showing the last answers; Keewano did not respond.');
    this.cache.set(key, { at, items });
    return this.view(items, at, !anyOk, note);
  }
}
