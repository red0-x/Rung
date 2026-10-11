import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import { createMockDial, type MockDial } from '../src/dial.js';
import { createOtpService } from '../src/otp.js';
import { createMemoryStore } from '../src/store/memory.js';
import type { Store } from '../src/store/types.js';

export const SECRET = 's3cret';
export const WEBHOOK_SECRET = 'whsec_test';
export const START = 1_700_000_000_000;

export interface Harness {
  base: string;
  store: Store;
  dial: MockDial;
  cfg: Config;
  clock: { t: number };
  advanceMin(min: number): void;
  close(): Promise<void>;
}

export async function boot(env: Record<string, string> = {}): Promise<Harness> {
  const cfg = loadConfig({
    NODE_ENV: 'test',
    MCP_SHARED_SECRET: SECRET,
    DIAL_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DEMO_SHOW_CODES: 'true',
    ...env,
  });
  const clock = { t: START };
  const now = () => clock.t;
  const store = createMemoryStore();
  const dial = createMockDial();
  const otp = createOtpService(store, { now, trackDemoCodes: cfg.demoShowCodes });
  const app = createApp({ store, otp, dial, cfg, now, log: () => {} });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    base: `http://127.0.0.1:${port}`,
    store,
    dial,
    cfg,
    clock,
    advanceMin: (min) => {
      clock.t += min * 60_000;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  };
}

export async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms = 2000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 15));
  }
}

/** The 6-digit code from the most recent SMS the mock sent. */
export function lastCode(dial: MockDial): string {
  const body = dial.sent.at(-1)?.body ?? '';
  const m = body.match(/\b(\d{6})\b/);
  if (!m) throw new Error(`no code in SMS: ${body}`);
  return m[1]!;
}
