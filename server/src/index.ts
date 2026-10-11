import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { checkConfig, loadConfig } from './config.js';
import { createDialClient, withLog } from './dial.js';
import { mcpUrl } from './orgs.js';
import { createOtpService } from './otp.js';
import { reseedOrg, seedAll, type SeedDeps } from './seed.js';
import { createMemoryStore } from './store/memory.js';
import { createSupabaseClient, createSupabaseStore } from './store/supabase.js';

const cfg = loadConfig();
const { fatal, warnings } = checkConfig(cfg);
for (const w of warnings) console.warn(`[config] ${w}`);
if (fatal.length) {
  for (const f of fatal) console.error(`[config] FATAL: ${f}`);
  process.exit(1);
}

const log = (msg: string) => console.log(`${new Date().toISOString().slice(11, 23)} ${msg}`);

const sb = cfg.supabaseUrl && cfg.supabaseServiceKey ? createSupabaseClient(cfg.supabaseUrl, cfg.supabaseServiceKey) : null;
const store = cfg.store === 'supabase' ? createSupabaseStore(sb!) : createMemoryStore();
const auth = createAuth(cfg, sb);
const dial = withLog(createDialClient(cfg));
const otp = createOtpService(store, { trackDemoCodes: cfg.demoShowCodes });

const seedDeps = (): SeedDeps => ({ store, auth, env: process.env, now: Date.now(), log });

if (cfg.seedOnBoot) {
  // Idempotent: orgs are matched by slug (tokens and settings are kept), seed rows have fixed ids.
  await seedAll(seedDeps());
}

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

app.listen(cfg.port, '0.0.0.0', async () => {
  log(`Rung server on :${cfg.port}  env=${cfg.env}  store=${store.kind}  dial=${dial.mock ? 'mock' : 'live'}  devAuth=${cfg.enableDev}`);
  log('  Dial webhooks  POST /webhooks/dial');
  log('  Dashboard API  /api/*  (GET /api/health is public)');
  log(
    `  Context MCP    POST ${cfg.publicUrl}/mcp  (one per Dial account; header X-Mcp-Secret${cfg.mcpSharedSecret ? '' : ' NOT SET'}; org from X-Dial-Agent-Number)`,
  );
  log('  Per-org MCP URLs (also accepted):');
  for (const org of await store.listOrgs()) {
    log(`    ${org.name.padEnd(20)} ${mcpUrl(cfg, org)}  number=${org.dialNumber ?? '(none)'}`);
  }
});
