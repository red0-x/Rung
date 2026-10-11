import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { loadConfig, type Config } from '../src/config.js';
import { createMockDial, withLog, type DialClient, type DialLog, type MockDial } from '../src/dial.js';
import { createOtpService } from '../src/otp.js';
import { reseedOrg, seedAll, type SeedDeps } from '../src/seed.js';
import { createMemoryStore } from '../src/store/memory.js';
import type { Store } from '../src/store/types.js';
import type { Org } from '../src/types.js';

export const WEBHOOK_SECRET = 'whsec_test';
export const START = 1_700_000_000_000;
export const BANK_EMAIL = 'bank@test.rung';
export const CLINIC_EMAIL = 'clinic@test.rung';
export const MARIA = '+15555550101'; // seeded at BOTH orgs, different names
export const JAMES = '+15555550102'; // bank only
export const NEW_CALLER = '+14155550111';

export interface Harness {
  base: string;
  store: Store;
  dial: MockDial;
  logged: DialClient & { log: DialLog };
  cfg: Config;
  clock: { t: number };
  bank: Org;
  clinic: Org;
  advanceMin(min: number): void;
  /** Dashboard API call as a dev user (default: the bank admin). Pass email=null for no auth header. */
  api(path: string, opts?: { method?: string; body?: unknown; as?: string | null }): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

export async function boot(env: Record<string, string> = {}): Promise<Harness> {
  const fullEnv = {
    NODE_ENV: 'test',
    STORE: 'memory',
    DIAL_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DEMO_BANK_EMAIL: BANK_EMAIL,
    DEMO_CLINIC_EMAIL: CLINIC_EMAIL,
    ...env,
  };
  const cfg = loadConfig(fullEnv);
  const clock = { t: START };
  const now = () => clock.t;
  const store = createMemoryStore();
  const dial = createMockDial();
  const logged = withLog(dial, now);
  const auth = createAuth(cfg, null);
  const otp = createOtpService(store, { now, trackDemoCodes: cfg.demoShowCodes });
  const seedDeps = (): SeedDeps => ({ store, auth, env: fullEnv, now: clock.t, log: () => {} });
  const [bank, clinic] = await seedAll(seedDeps());
  const app = createApp({
    store,
    otp,
    dial: logged,
    cfg,
    auth,
    now,
    log: () => {},
    reseedOrg: (org) => reseedOrg(org, seedDeps()),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    store,
    dial,
    logged,
    cfg,
    clock,
    bank: bank!,
    clinic: clinic!,
    advanceMin: (min) => {
      clock.t += min * 60_000;
    },
    async api(path, opts = {}) {
      const as = opts.as === undefined ? BANK_EMAIL : opts.as;
      const headers: Record<string, string> = {};
      if (as !== null) headers.authorization = `Bearer dev:${as}`;
      if (opts.body !== undefined) headers['content-type'] = 'application/json';
      const res = await fetch(`${base}/api${path}`, {
        method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const text = await res.text();
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* not json */
      }
      return { status: res.status, body };
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
