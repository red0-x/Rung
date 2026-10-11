---
type: log
date: 2026-10-11 14:25
author: jadon
tags: [area/stretch, area/backend]
---
# Keewano patch merged onto current main, non-blocking on Vercel

- **Did:** applied conrad's `keewano-rung.patch` onto current `main` (conflicts in `app.ts`/`mcp.ts` kept both sides). Replaced the up-to-2.5 s blocking flush with `waitUntil` from `@vercel/functions`, so Keewano never delays a live tool call. 116 tests green, Vercel bundle builds.
- **Others need to know:** new server dep `@vercel/functions`. Keewano is on only when `KEEWANO_SDK_KEY` / `KEEWANO_ACCESS_TOKEN` are set (local `.env` + Vercel project `rung`). `KEEWANO_MCP_DAILY_LIMIT=0` assumes `#SpeedHacks` was sent in Keewano's chat.
- **Files / endpoints touched:** `server/src/{keewano,config,mcp,app,runtime}.ts`, `server/test/{keewano.test,helpers}.ts`, `server/package.json`, `.env.example`. Endpoint `GET /api/insights` (see conrad's log).
- **Next:** keys on Vercel + redeploy; verify events arrive in Keewano; dashboard Insights strip reading `GET /api/insights`.
