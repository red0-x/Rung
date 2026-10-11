---
type: log
date: 2026-10-11 14:00
author: conrad
tags: [area/stretch, contract-change]
---
# Keewano: call events + GET /api/insights

- **Did:** added `server/src/keewano.ts`. MCP tools and the callback/done routes send one-token events to Keewano (fire-and-forget, never blocks a call, caller = HMAC UUID, no phone/name/amount). New dashboard endpoint `GET /api/insights` returns three cached plain-English stats for the signed-in org (queued by urgency, returning vs new callers, callbacks by urgency).
- **Others need to know:** `#contract-change`: new endpoint `GET /api/insights` (Bearer auth, org-scoped, always 200). Shape: `{enabled, asOf, stale, items:[{id,title,answer,error?}], note?}`. `?refresh=1` re-asks Keewano (min 60 s apart). `GET /api/health` now includes `keewano` stats. No tool names, tables, or existing endpoints changed. Whole feature is off unless `KEEWANO_SDK_KEY` / `KEEWANO_ACCESS_TOKEN` are set.
- **Files / endpoints touched:** `server/src/{keewano,config,mcp,app,runtime}.ts`, `server/test/{keewano.test,helpers}.ts`, `.env.example`, `vault/areas/stretch.md`, `vault/open-questions.md`.
- **Next:** web owner can render `items` as an Insights strip on the dashboard (optional). Set the two Keewano env vars on Vercel.
