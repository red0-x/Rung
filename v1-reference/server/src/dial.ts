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

export interface DialClient {
  readonly mock: boolean;
  /** POST /messages. Not idempotent on Dial's side: do not blindly retry. */
  sendSms(to: string, body: string): Promise<void>;
  /** GET /calls/{id}: the only place the transcript and caller number live after a call. */
  getCall(id: string): Promise<DialCall>;
}

export class DialApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Dial API ${status}: ${detail.slice(0, 200)}`);
  }
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
    return res.json();
  }

  return {
    mock: false,
    async sendSms(to, body) {
      await request('/messages', {
        method: 'POST',
        body: JSON.stringify({ to, fromNumber: cfg.dialNumber, body }),
      });
    },
    async getCall(id) {
      const data = await request(`/calls/${encodeURIComponent(id)}`);
      return (data.call ?? data) as DialCall;
    },
  };
}

export interface MockDial extends DialClient {
  sent: Array<{ to: string; body: string }>;
  calls: Map<string, DialCall>;
  failNextSms: boolean;
}

export function createMockDial(opts: { log?: boolean } = {}): MockDial {
  const mock: MockDial = {
    mock: true,
    sent: [],
    calls: new Map(),
    failNextSms: false,
    async sendSms(to, body) {
      if (mock.failNextSms) {
        mock.failNextSms = false;
        throw new DialApiError(500, 'mock failure');
      }
      mock.sent.push({ to, body });
      if (opts.log) console.log(`[dial:mock] SMS to ${to}: ${body}`);
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
