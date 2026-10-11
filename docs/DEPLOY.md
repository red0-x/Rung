# Deploying Rung

Two pieces:

| Piece | Where | Why |
| --- | --- | --- |
| `server/` (MCP + webhooks + JSON API) | Railway, Render or Fly, as one long-running Node 22 process | Dial calls `/mcp` mid-call and posts webhooks; OTP rate limits and demo codes live in process memory. Not serverless, not Supabase Edge Functions. |
| `web/` (dashboard) | Vercel | Static Vite build. Talks only to the server API with the user's Supabase access token. |

Supabase = Postgres + Auth. Schema: `supabase/migrations/` (apply with `supabase db push`).

## Server (Railway shown; Render/Fly are the same shape)

1. New service from the GitHub repo. **Root directory: the repo root** (the server reads `docs/inbound-prompt.md` at runtime and npm workspaces live at the root).
2. Build: `npm ci` (keep dev dependencies: the server runs through `tsx`). On Render set `NPM_CONFIG_PRODUCTION=false` if it prunes dev deps.
3. Start: `npm start -w server`.
4. Health check path: `/api/health`.
5. Env vars (below), with `NODE_ENV=production` and `PUBLIC_URL=https://<your-service-domain>`.
6. One instance only (demo codes and the Dial log are in memory). The process listens on `PORT` (Railway/Render inject it).

Boot prints the account-wide MCP URL and each org's per-org MCP URL. Production refuses to boot without `DIAL_WEBHOOK_SECRET`, `MCP_SHARED_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Web (Vercel)

- Root directory `web`, framework Vite, build `npm run build`, output `dist`.
- Env: `VITE_API_BASE=https://<server-domain>`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Set the server's `CORS_ORIGIN` to the Vercel URL(s), comma-separated (or leave `*`).
- Supabase Auth redirect URLs already allow `*.vercel.app`.

## Environment variables

Server:

| Var | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | prod | `production` turns off dev auth and enforces the secrets below |
| `PORT` | no | default 8787 |
| `PUBLIC_URL` | prod | base for MCP URLs printed on boot and returned as `org.mcpUrl` |
| `CORS_ORIGIN` | no | default `*` |
| `STORE` | no | `memory` / `supabase`; default supabase when its keys are set |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | prod | store + JWT verification (`auth.getUser`) + demo-user lookup |
| `DIAL_API_KEY` | live | blank = mock Dial |
| `DIAL_API_BASE` | no | default `https://api.getdial.ai/api/v1` |
| `DIAL_WEBHOOK_SECRET` | prod | `whsec_...` |
| `MCP_SHARED_SECRET` | prod | static `X-Mcp-Secret` header on the Dial Context MCP |
| `DIAL_NUMBER_POOL` | live | `[{"id":"...","number":"+1..."}]` |
| `DIAL_MOCK` | no | `true` forces the mock client even with a key |
| `DEMO_SHOW_CODES` | no | default `true` (texted codes visible on the dashboard) |
| `ENABLE_DEV` | no | default true outside production; always off in production |
| `REQUIRE_INBOUND`, `SEED_ON_BOOT` | no | default true |
| `DEMO_BANK_EMAIL`, `DEMO_CLINIC_EMAIL` | no | default `bank@rung.demo` / `clinic@rung.demo`; linked to the seeded orgs |
| `PROMPT_TEMPLATE_PATH` | no | default `docs/inbound-prompt.md` |

Web: `VITE_API_BASE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

CLI only: `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`.

## Smoke test after deploy

```bash
curl https://<server>/api/health                       # {"ok":true,"store":"supabase","dial":"live",...}
npm run simulate -- --base https://<server> --from +15555550101 \
  --agent-number <org dial number> --secret "$MCP_SHARED_SECRET"   # lookup_caller -> Maria at Demo Bank
```

(`demo:sim` uses dev auth, so it only works against a non-production server.)
