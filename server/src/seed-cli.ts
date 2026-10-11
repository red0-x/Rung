/** `npm run seed -w server`: idempotently create the demo orgs, link demo users, and (re)seed returning callers. */
import { loadConfig } from './config.js';
import { mcpUrl } from './orgs.js';
import { createRuntime, log } from './runtime.js';
import { seedAll } from './seed.js';

const cfg = loadConfig();
const { seedDeps } = createRuntime(cfg);
const orgs = await seedAll(seedDeps());
log(`seeded ${orgs.length} orgs into the ${cfg.store} store`);
for (const o of orgs) log(`  ${o.name.padEnd(20)} ${mcpUrl(cfg, o).replace(/\/mcp\/.+$/, '/mcp/<token>')}`);
