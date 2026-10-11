/**
 * Vercel Node function entry (bundled by scripts/vercel-build.mjs into .vercel/output/functions/api.func).
 * Builds the Express app once per instance, lazily; never listens and never seeds (run `npm run seed -w server`).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkConfig, loadConfig } from './config.js';
import { createRuntime, type Runtime } from './runtime.js';

let runtime: Promise<Runtime> | null = null;

function boot(): Promise<Runtime> {
  return (async () => {
    const cfg = loadConfig();
    const { fatal, warnings } = checkConfig(cfg);
    for (const w of warnings) console.warn(`[config] ${w}`);
    if (fatal.length) throw new Error(`config: ${fatal.join(' ')}`);
    return createRuntime(cfg);
  })();
}

/**
 * The routing layer rewrites /api/*, /mcp*, /webhooks/* to this function and passes the original
 * path as `__rung_path`. Restore it so Express routes on the path the client actually requested.
 */
export function restoreUrl(url: string): string {
  const u = new URL(url, 'http://x');
  const orig = u.searchParams.get('__rung_path');
  if (orig === null) return url;
  u.searchParams.delete('__rung_path');
  const qs = u.searchParams.toString();
  return `${orig.startsWith('/') ? orig : `/${orig}`}${qs ? `?${qs}` : ''}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let rt: Runtime;
  try {
    rt = await (runtime ??= boot());
  } catch (err) {
    runtime = null;
    console.error(`[boot] ${(err as Error).message}`);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'server_misconfigured' }));
    return;
  }
  req.url = restoreUrl(req.url ?? '/');
  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    rt.app(req as any, res as any);
  });
}
