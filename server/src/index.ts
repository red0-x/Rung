import { checkConfig, loadConfig } from './config.js';
import { mcpUrl } from './orgs.js';
import { createRuntime, log } from './runtime.js';
import { seedAll } from './seed.js';

const cfg = loadConfig();
const { fatal, warnings } = checkConfig(cfg);
for (const w of warnings) console.warn(`[config] ${w}`);
if (fatal.length) {
  for (const f of fatal) console.error(`[config] FATAL: ${f}`);
  process.exit(1);
}

const { app, store, seedDeps } = createRuntime(cfg);

if (cfg.seedOnBoot) {
  // Idempotent: orgs are matched by slug (tokens and settings are kept), seed rows have fixed ids.
  await seedAll(seedDeps());
}

app.listen(cfg.port, '0.0.0.0', async () => {
  log(`Rung server on :${cfg.port}  env=${cfg.env}  store=${store.kind}  dial=${cfg.dialMock ? 'mock' : 'live'}  devAuth=${cfg.enableDev}`);
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
