---
type: area
owner: 
---
# Area: backend

One service: MCP server for Dial, webhook receiver, `/api/queue`. Owns [[project/contracts]].

## Status
- [x] Supabase project `Rung` + Auth (email/password, demo users) — 2026-10-11
- [x] Multi-tenant build (one-shot Phase A) — 2026-10-11
  - [x] Migration `20261011200000_rung_multitenant` pushed; memory + Supabase stores; 2 seeded orgs (Demo Bank, Northside Clinic)
  - [x] 5 MCP tools, org from `/mcp/<token>` or `X-Dial-Agent-Number`; OTP hashed + limits
  - [x] Per-org scoring (116 / 60 / 20 demo check), webhooks (HMAC, dedupe), org-scoped API with Supabase JWT
  - [x] `npm run demo:sim` fills the bank queue fraud > $10M > $12; 65 tests green
  - [x] `docs/DEPLOY.md`, `docs/GO_LIVE.md`, `docs/inbound-prompt.md`
- [x] Dial API key works; REST base `/api/v1` verified; 1 number in `DIAL_NUMBER_POOL`
- [ ] Second Dial number (clinic) — ideally an iMessage number
- [ ] Deploy server (Railway/Render/Fly) → post URL below
- [ ] Register webhook + one Context MCP (`/mcp` + `X-Mcp-Secret`), Publish prompt, hello call

## Public URL
<!-- current base URL; update when it changes -->

## Requests
