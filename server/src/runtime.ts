import type { Express } from 'express';
import { createApp } from './app.js';
import { createAuth, type Auth } from './auth.js';
import type { Config } from './config.js';
import { createDialClient, withLog } from './dial.js';
import { createOtpService } from './otp.js';
import { reseedOrg, type SeedDeps } from './seed.js';
import { createMemoryStore } from './store/memory.js';
import type { Store } from './store/types.js';
import { createSupabaseClient, createSupabaseStore } from './store/supabase.js';

export const log = (msg: string) => console.log(`${new Date().toISOString().slice(11, 23)} ${msg}`);

export interface Runtime {
  app: Express;
  store: Store;
  auth: Auth;
  seedDeps: () => SeedDeps;
}

/** Everything the server needs, without listen() or seeding (shared by the local server and the Vercel function). */
export function createRuntime(cfg: Config, env: Record<string, string | undefined> = process.env): Runtime {
  const sb = cfg.supabaseUrl && cfg.supabaseServiceKey ? createSupabaseClient(cfg.supabaseUrl, cfg.supabaseServiceKey) : null;
  const store = cfg.store === 'supabase' ? createSupabaseStore(sb!) : createMemoryStore();
  const auth = createAuth(cfg, sb);
  const dial = withLog(createDialClient(cfg));
  const otp = createOtpService(store, { trackDemoCodes: cfg.demoShowCodes });
  const seedDeps = (): SeedDeps => ({ store, auth, env, now: Date.now(), log });
  const app = createApp({
    store,
    otp,
    dial,
    cfg,
    auth,
    now: Date.now,
    log,
    reseedOrg: (org) => reseedOrg(org, seedDeps()),
  });
  return { app, store, auth, seedDeps };
}
