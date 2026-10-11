# Deploying Rung

**One Vercel project, one URL:** `rung` (team jadon-lis-projects), production alias **https://rung-liart.vercel.app**.
The project is Git-connected to GitHub `jadonli09/rung`: a push to `main` deploys production; `npx vercel deploy`
from a checkout makes a preview.

| Path | Served by |
| --- | --- |
| `/`, `/login`, `/queue`, `/setup`, `/callers`, any other non-file path | `web/` static build, SPA fallback to `index.html` |
| `/assets/*`, `/favicon.svg`, ... | static files (missing `/assets/*` → 404, not the SPA) |
| `/api/*`, `/mcp`, `/mcp/*`, `/webhooks/*` | one Node 22 function (`api`, region iad1 next to Supabase us-east-1, maxDuration 30 s) |

Supabase = Postgres + Auth. Schema: `supabase/migrations/` (apply with `supabase db push`).

## How the build works

`vercel.json` runs `node scripts/vercel-build.mjs`, which writes the Build Output API directly:

- `.vercel/output/static/`: `npm run build -w web` with `VITE_API_BASE=''` (same-origin `/api`).
- `.vercel/output/functions/api.func/index.mjs`: `server/src/vercel.ts` bundled by esbuild into one ESM file (no
  `node_modules` needed). `docs/inbound-prompt.md` is inlined at build time. `.vc-config.json`: `nodejs22.x`,
  `launcherType: Nodejs`, `shouldAddHelpers: false` (keeps the raw body for webhook signatures).
- `.vercel/output/config.json`: routes `/api|/mcp|/webhooks…` → the function as `/api?__rung_path=<original path>`;
  the handler restores `req.url` from `__rung_path` (other query params kept), so Express always routes on the
  path the client requested. Then filesystem, then SPA fallback.

Verify locally: `npx vercel pull --yes --environment=preview && npx vercel build`, then inspect `.vercel/output`;
`npx vercel deploy --prebuilt` uploads exactly that. Preview URLs are behind Vercel Authentication: test them with
`npx vercel curl <path> --deployment <url>`.

## Serverless behavior

- `server/src/vercel.ts` builds the Express app once per instance (cached promise), never calls `listen()`, never
  seeds. Seed (idempotent, same Supabase DB for dev and prod): `npm run seed -w server`.
- Webhooks: on Vercel (`VERCEL` set, or `INLINE_WEBHOOKS=true`) the event is processed **before** the 200 (Dial
  allows 10 s; event-id dedupe covers retries). Locally the 200 goes first, as before.
- In-process state: texted-code tracking and the mock Dial log live in memory per instance. Both only matter with
  `REQUIRE_VERIFICATION=true` / mock Dial, which production doesn't use.
- Local dev is unchanged: `npm run dev:server` (long-running, seeds on boot).

## Deviation from the original rule: missing webhook secret

Production refuses to boot without `MCP_SHARED_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. A missing
`DIAL_WEBHOOK_SECRET` no longer stops boot (the webhook didn't exist yet when we deployed): instead
`POST /webhooks/dial` answers `503 {"error":"webhook_secret_missing"}` and `/api/health` reports
`"webhookVerify": false`. Unsigned events are never accepted in production.

## Environment variables (Vercel project, Production + Preview)

| Var | Notes |
| --- | --- |
| `NODE_ENV` | `production`: dev auth off, secrets enforced |
| `PUBLIC_URL` | `https://rung-liart.vercel.app` (MCP URLs shown in the dashboard) |
| `STORE` | `supabase` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (sensitive) | store, JWT verification, demo-user lookup |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | baked into the web build |
| `DIAL_API_KEY` (sensitive), `DIAL_API_BASE` | live Dial (`https://api.getdial.ai/api/v1`) |
| `DIAL_NUMBER_POOL` | `[{"id":"...","number":"+1..."}]` (two real numbers) |
| `MCP_SHARED_SECRET` (sensitive) | static `X-Mcp-Secret` header on Dial's Context MCP; also in local `.env` |
| `DIAL_WEBHOOK_SECRET` (sensitive) | **not set yet**; add after creating the Dial webhook (`docs/GO_LIVE.md` step 3) |
| `REQUIRE_VERIFICATION` | `false` (no texted codes until 10DLC) |
| `DEMO_BANK_EMAIL`, `DEMO_CLINIC_EMAIL` | seeded org admins |

Optional: `CORS_ORIGIN` (default `*`; same origin anyway), `DEMO_SHOW_CODES`, `REQUIRE_INBOUND`, `INLINE_WEBHOOKS`,
`PROMPT_TEMPLATE_PATH`. Never set `DIAL_MOCK` or `ENABLE_DEV` in production.

Set a value without printing it: `printf '%s' "$VALUE" | npx vercel env add NAME production --sensitive --force --scope jadon-lis-projects`.

## Smoke test

```bash
curl https://rung-liart.vercel.app/api/health    # {"ok":true,"store":"supabase","dial":"live","mcpAuth":true,...}
curl -X POST https://rung-liart.vercel.app/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' -H "x-mcp-secret: $MCP_SHARED_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'      # lookup_caller, save_profile, triage_call
npm run simulate -- --base https://rung-liart.vercel.app --from +15555550101 \
  --agent-number <bank's claimed number> --secret "$MCP_SHARED_SECRET"   # Maria at Bank of Antarctica
```

(`demo:sim` uses dev auth, so it only works against a local dev server.)
