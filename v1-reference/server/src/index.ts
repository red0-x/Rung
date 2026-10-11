import { createApp } from './app.js';
import { checkConfig, loadConfig } from './config.js';
import { createDialClient } from './dial.js';
import { createOtpService } from './otp.js';
import { loadSeed, seedStore } from './seed.js';
import { createMemoryStore } from './store/memory.js';
import { createSupabaseStore } from './store/supabase.js';

const cfg = loadConfig();
const { fatal, warnings } = checkConfig(cfg);
for (const w of warnings) console.warn(`[config] ${w}`);
if (fatal.length) {
  for (const f of fatal) console.error(`[config] FATAL: ${f}`);
  process.exit(1);
}

const log = (msg: string) => console.log(`${new Date().toISOString().slice(11, 23)} ${msg}`);

const store =
  cfg.store === 'supabase' ? createSupabaseStore(cfg.supabaseUrl!, cfg.supabaseServiceKey!) : createMemoryStore();
const dial = createDialClient(cfg);
const otp = createOtpService(store, { trackDemoCodes: cfg.demoShowCodes });

async function reseed() {
  const found = loadSeed(cfg.seedFile);
  if (!found) {
    log('no seed file found (server/seed.json or seed.example.json)');
    return;
  }
  const n = await seedStore(store, found.seed, Date.now());
  log(`seeded ${n} returning callers from ${found.source}`);
}

// The in-memory store starts empty on every boot, so reseed it. Supabase persists:
// reseed explicitly with POST /api/dev/reset instead of duplicating history each boot.
if (cfg.seedOnBoot && store.kind === 'memory') await reseed();

const app = createApp({ store, otp, dial, cfg, now: Date.now, log, reseed });

app.listen(cfg.port, '0.0.0.0', () => {
  log(`listening on :${cfg.port}  store=${store.kind}  dial=${dial.mock ? 'mock' : 'live'}`);
  log(`  MCP endpoint   POST /mcp${cfg.mcpSharedSecret ? ' (or /mcp/<MCP_SHARED_SECRET>)' : ''}`);
  log('  Dial webhooks  POST /webhooks/dial');
  log('  Dashboard API  GET  /api/queue');
});
