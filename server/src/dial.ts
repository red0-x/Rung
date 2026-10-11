import type { Config } from './config.js';
import type { TranscriptTurn } from './types.js';

export interface DialCall {
  id: string;
  from?: string;
  to?: string;
  direction?: string;
  duration?: number;
  transcript?: string | null;
  transcriptTurns?: TranscriptTurn[] | null;
  createdAt?: string;
}

/** Which org a Dial request was made for, so the dashboard's Dial log stays org-scoped. */
export interface DialCtx {
  orgId?: string | null;
}

export interface DialClient {
  readonly mock: boolean;
  /** POST /messages. Not idempotent on Dial's side: do not blindly retry. */
  sendSms(to: string, body: string, fromNumber: string | null, ctx?: DialCtx): Promise<void>;
  /** PATCH /numbers/{id} {inboundInstruction}: what the agent says and does on this number. */
  updateNumberInstruction(numberId: string, inboundInstruction: string, ctx?: DialCtx): Promise<void>;
  /** GET /calls/{id}: the only place the transcript and caller number live after a call. */
  getCall(id: string, ctx?: DialCtx): Promise<DialCall>;
}

export interface DialLog {
  sms: Array<{ orgId: string | null; to: string; from: string | null; body: string; at: number }>;
  patches: Array<{ orgId: string | null; numberId: string; inboundInstruction: string; at: number }>;
  callFetches: Array<{ orgId: string | null; callId: string; at: number }>;
}

export class DialApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Dial API ${status}: ${detail.slice(0, 200)}`);
  }
}

const LOG_CAP = 200;
const push = <T>(list: T[], v: T) => {
  list.push(v);
  if (list.length > LOG_CAP) list.splice(0, list.length - LOG_CAP);
};

/**
 * Wraps any client so every request is recorded (per org) for /api/dev/dial-log.
 * Requests are recorded whether or not they succeed.
 */
export function withLog(inner: DialClient, now: () => number = Date.now): DialClient & { log: DialLog } {
  const log: DialLog = { sms: [], patches: [], callFetches: [] };
  return {
    mock: inner.mock,
    log,
    async sendSms(to, body, fromNumber, ctx) {
      push(log.sms, { orgId: ctx?.orgId ?? null, to, from: fromNumber, body, at: now() });
      await inner.sendSms(to, body, fromNumber, ctx);
    },
    async updateNumberInstruction(numberId, inboundInstruction, ctx) {
      push(log.patches, { orgId: ctx?.orgId ?? null, numberId, inboundInstruction, at: now() });
      await inner.updateNumberInstruction(numberId, inboundInstruction, ctx);
    },
    async getCall(id, ctx) {
      push(log.callFetches, { orgId: ctx?.orgId ?? null, callId: id, at: now() });
      return inner.getCall(id, ctx);
    },
  };
}

export function createDialClient(cfg: Config): DialClient {
  if (cfg.dialMock) return createMockDial({ log: cfg.env !== 'test' });

  async function request(path: string, init: RequestInit = {}): Promise<any> {
    const res = await fetch(`${cfg.dialApiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.dialApiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new DialApiError(res.status, await res.text().catch(() => ''));
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  return {
    mock: false,
    async sendSms(to, body, fromNumber) {
      await request('/messages', {
        method: 'POST',
        body: JSON.stringify(fromNumber ? { to, fromNumber, body } : { to, body }),
      });
    },
    async updateNumberInstruction(numberId, inboundInstruction) {
      await request(`/numbers/${encodeURIComponent(numberId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ inboundInstruction }),
      });
    },
    async getCall(id) {
      const data = await request(`/calls/${encodeURIComponent(id)}`);
      return (data.call ?? data) as DialCall;
    },
  };
}

export interface MockDial extends DialClient {
  sent: Array<{ to: string; body: string; from: string | null }>;
  patches: Array<{ numberId: string; inboundInstruction: string }>;
  calls: Map<string, DialCall>;
  failNextSms: boolean;
}

export function createMockDial(opts: { log?: boolean } = {}): MockDial {
  const mock: MockDial = {
    mock: true,
    sent: [],
    patches: [],
    calls: new Map(),
    failNextSms: false,
    async sendSms(to, body, fromNumber) {
      if (mock.failNextSms) {
        mock.failNextSms = false;
        throw new DialApiError(500, 'mock failure');
      }
      mock.sent.push({ to, body, from: fromNumber });
      if (opts.log) console.log(`[dial:mock] SMS from ${fromNumber ?? '(none)'} to ${to}: ${body}`);
    },
    async updateNumberInstruction(numberId, inboundInstruction) {
      mock.patches.push({ numberId, inboundInstruction });
      if (opts.log) console.log(`[dial:mock] PATCH /numbers/${numberId} inboundInstruction (${inboundInstruction.length} chars)`);
    },
    async getCall(id) {
      return (
        mock.calls.get(id) ?? {
          id,
          transcript: `agent: Thanks for calling. How can I help?\nuser: (mock transcript for ${id})`,
          transcriptTurns: [
            { speaker: 'agent', text: 'Thanks for calling. How can I help?', startMs: 0, endMs: 2000 },
            { speaker: 'user', text: `(mock transcript for ${id})`, startMs: 2400, endMs: 5000 },
          ],
        }
      );
    },
  };
  return mock;
}
