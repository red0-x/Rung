---
type: area
owner: 
---
# Area: backend

One service: MCP server for Dial, webhook receiver, `/api/queue`. Owns [[project/contracts]].

## Status
- [x] Supabase project `Rung` + Auth (email/password, demo users) — 2026-10-11
- [ ] Multi-tenant build via `ONE_SHOT_PROMPT.md` (in progress)
- [ ] Public URL (ngrok or deploy) — post it below
- [ ] `lookup_caller` reading `X-Dial-User-Number`
- [ ] `send_code` / `check_code` / `save_profile`
- [ ] `triage_call` + scoring + `reason`
- [ ] `GET /api/queue`, `POST /api/calls/:id/status`
- [ ] `/webhooks/dial` with HMAC check, writes `brief`

## Public URL
<!-- current base URL; update when it changes -->

## Requests
