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
- [x] Multi-rep: atomic claims, `POST /api/queue/next`, claimer/admin permissions, presence + reps-online ETA, `DEMO_BANK_REPS` seeding — 2026-10-11
- [x] Forget caller: `DELETE /api/callers/:key` (admin) — 2026-10-11
- [x] Org invites (`POST /api/org/invites`, accepted on `/me`) + `X-Org-Id` org selection — 2026-10-11

## Public URL
<!-- current base URL; update when it changes -->
https://www.tryrung.today  (dashboard, `/api`, `/mcp`, `/webhooks/dial`) — main site from 2026-10-11. Old https://rung-liart.vercel.app: pages redirect to www; `/api`, `/mcp`, `/webhooks` still served (Dial registered there).

## Requests
- [x] **Deploy needed (from red):** done 2026-10-11 by jadon (`c04be27`, prompts republished, `update_profile` live). `red0-x/Rung` `main` has the ETA text + caller facts ([[log/2026-10-11-2105-red-eta-sms-and-caller-facts]]). Please push `main` to `jadonli09/rung` so Vercel redeploys and migration `20261011210000_caller_facts_and_eta.sql` applies. Then republish both orgs' prompts (`POST /api/org/publish`). Do the prompt only after the deploy: it calls `update_profile`, which the live server lacks today.
- [ ] **10DLC (from red):** Bank number `+1618...` is `not_registered`, Clinic `+1571...` is `with_carrier`. ETA texts to normal phones fail until approved ($25 per number, `POST /numbers/{id}/10dlc`). Who has the business or sole-proprietor details to submit the Bank number?

## Deploy setup (2026-10-11)
- GitHub: `jadonli09/rung` (private) is the deploy repo; `red0-x/Rung` stays the team/vault remote. Push `main` to both.
- Vercel project `rung` (Jadon Li's projects) builds from `jadonli09/rung` `main` → https://rung-liart.vercel.app. Web + server on one URL.
- Supabase project `Rung` GitHub integration → `jadonli09/rung`, dir `supabase`: migrations on `main` apply to production.
