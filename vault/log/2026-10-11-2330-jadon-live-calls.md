---
type: log
date: 2026-10-11 23:30
author: jadon
tags: [area/backend, area/dashboard, contract-change]
---
# "On the line now": see calls the voice agent is handling before they reach the queue #contract-change

- **Did:** new table `live_calls(org_id, phone, known, name, stage, started_at, updated_at, queued_at)`. `lookup_caller` starts a row; `send_code` → verifying, `check_code` ok → verified, `save_profile`/`update_profile` → saving, `triage_call` → queued (tools after that don't move it); `call.ended` deletes it. `GET /api/queue` adds `live[]` (shape in `docs/API.md`). Queue page shows an "On the line now" strip with a timer and a 3-step track; a triaged card turns blue for 8 s while its row lands in the queue.
- **Others need to know:** migration `20261012000000_live_calls.sql` is pushed to Supabase. If the table is ever missing, `live` comes back `[]` and the queue keeps working. Progress is tool steps only: Dial sends no transcript mid-call. Insights "How this works" card is now one footnote line.
- **Files / endpoints touched:** `server/src/{types,mcp,events,app}.ts`, `server/src/store/*`, `server/test/live-calls.test.ts`, `web/src/components/LiveCalls.tsx`, `web/src/pages/{Queue,Insights}.tsx`, `web/src/app.css`, `docs/API.md`.
- **Next:** backend owner adds `live_calls` + `live[]` to `project/contracts.md`. Code in `b0437fb`, deployed.
