---
type: log
date: 2026-10-11 12:50
author: jadon
tags: [area/backend, area/dashboard, area/voice, contract-change]
---
# Phase A built: multi-tenant Rung server + dashboard + landing; contracts v3 live

- **Did:** built `server/` (MCP, webhooks, API, Supabase store, seed, simulator) and `web/` (landing, login, queue, setup). Applied the multi-tenant migration. Bumped [[project/contracts]] to v3. Removed `v1-reference/`.
- **Evidence:** typecheck clean; 65 tests pass; `npm run demo:sim` → bank queue #1 fraud 116, #2 $10M 60, #3 $12 dispute 20; clinic sees none of it (404 on bank ids).
- **Others need to know:** run locally with `DIAL_MOCK=true npm run dev:server` + `npm run dev:web` (the Dial key is set, so without `DIAL_MOCK` it talks to real Dial). Demo logins: `bank@rung.demo`, `clinic@rung.demo`. Dial Context MCP is account-wide → one `/mcp` URL + `X-Mcp-Secret`. SMS to real phones is blocked (no 10DLC) → codes show on the dashboard.
- **Files / endpoints touched:** `server/`, `web/`, `scripts/simulate-call.ts`, `supabase/migrations/20261011200000_rung_multitenant.sql`, `docs/*`.
- **Next:** voice owner: second Dial number (ask for iMessage). Backend: deploy server, then `docs/GO_LIVE.md` (webhook, MCP, publish, hello call). Dashboard: Vercel deploy.
