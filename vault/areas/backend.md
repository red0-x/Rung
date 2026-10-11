---
type: area
owner: 
---
# Area: backend

One service: MCP server for Dial, webhook receiver, `/api/queue`. Owns [[project/contracts]].

## Status
- [x] Supabase project `Rung` + Auth (email/password, demo users) — 2026-10-11
- [x] Multi-tenant build (one-shot Phase A) — 2026-10-11
  - [x] Migration `20261011200000_rung_multitenant` pushed; memory + Supabase stores; 2 seeded orgs (Bank of Antarctica, Mango Clinic)
  - [x] 5 MCP tools, org from `/mcp/<token>` or `X-Dial-Agent-Number`; OTP hashed + limits
  - [x] Per-org scoring (116 / 60 / 20 demo check), webhooks (HMAC, dedupe), org-scoped API with Supabase JWT
  - [x] `npm run demo:sim` fills the bank queue fraud > $10M > $12; 65 tests green
  - [x] `docs/DEPLOY.md`, `docs/GO_LIVE.md`, `docs/inbound-prompt.md`
- [x] Dial API key works; REST base `/api/v1` verified; 1 number in `DIAL_NUMBER_POOL`
- [x] Second Dial number; Bank of Antarctica = +16184644253, Mango Clinic = +15717200334 (claimed + prompts published) — 2026-10-11
- [x] Deployed on Vercel (web + server, one URL) — 2026-10-11
- [x] Dial webhook (call.ended, call.transcribed) → `/webhooks/dial`, signature verified in prod
- [x] Dial Context MCP "Rung" → `/mcp` + `X-Mcp-Secret`: connected, 3 tools; prod lookup_caller greets Maria (bank) / Dana (clinic)
- [ ] Hello call from a real phone

## Public URL
<!-- current base URL; update when it changes -->
https://rung-liart.vercel.app  (dashboard, `/api`, `/mcp`, `/webhooks/dial`)

## Requests

## Deploy setup (2026-10-11)
- GitHub: `jadonli09/rung` (private) is the deploy repo; `red0-x/Rung` stays the team/vault remote. Push `main` to both.
- Vercel project `rung` (Jadon Li's projects) builds from `jadonli09/rung` `main` → https://rung-liart.vercel.app. Web + server on one URL.
- Supabase project `Rung` GitHub integration → `jadonli09/rung`, dir `supabase`: migrations on `main` apply to production.
