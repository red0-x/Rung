// Builds the whole app for Vercel with the Build Output API (v3):
//   .vercel/output/static/                  web/ (Vite build, same-origin API: VITE_API_BASE='')
//   .vercel/output/functions/api.func/      server/ bundled by esbuild into one ESM file
//   .vercel/output/config.json              routes: /api, /mcp, /webhooks -> function; SPA fallback
// Run by `vercel build` (vercel.json buildCommand) locally and on Vercel.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.vercel/output');
const fn = join(out, 'functions/api.func');

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

// 1. Dashboard + landing (static).
execSync('npm run build -w web', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_API_BASE: '' } });
cpSync(join(root, 'web/dist'), join(out, 'static'), { recursive: true });

// 2. Server function: one self-contained ESM file. The agent prompt template is inlined.
await build({
  entryPoints: [join(root, 'server/src/vercel.ts')],
  outfile: join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  define: { __RUNG_PROMPT_TEMPLATE__: JSON.stringify(readFileSync(join(root, 'docs/inbound-prompt.md'), 'utf8')) },
  // CommonJS dependencies (express, etc.) call require() on Node built-ins.
  banner: { js: "import { createRequire as __rungCreateRequire } from 'node:module'; const require = __rungCreateRequire(import.meta.url);" },
});
writeFileSync(join(fn, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(
  join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false, // keep the raw body stream: webhooks verify signatures on exact bytes
      maxDuration: 30,
      regions: ['iad1'], // Supabase is us-east-1
    },
    null,
    2,
  ),
);

// 3. Routing. The function gets the original path as ?__rung_path= (restored in server/src/vercel.ts),
// so Express always routes on what the client requested, whatever the platform does to req.url.
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/((?:api|mcp|webhooks)(?:/.*)?)$', dest: '/api?__rung_path=/$1' },
        { handle: 'filesystem' },
        { src: '^/assets/(.*)$', status: 404 },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('vercel-build: wrote .vercel/output (static + functions/api.func + config.json)');
