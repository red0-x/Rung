---
type: log
date: 2026-10-11 14:20
author: jadon
tags: [area/backend, area/voice]
---
# Live: Vercel prod + Dial webhook + Context MCP + both numbers published

- **Did:** prod at https://rung-liart.vercel.app (one Vercel project, server as a function in iad1). Created the Dial webhook (secret in Vercel env + local `.env`, signed self-test 200 / forged 401). Registered one Context MCP "Rung" (`/mcp`, static `X-Mcp-Secret`, connected, 3 tools). Claimed numbers and published prompts via the live API.
- **Others need to know:** call **+1 618 464 4253** = Demo Bank, **+1 571 720 0334** = Northside Clinic. Dashboard logins `bank@rung.demo` / `clinic@rung.demo` (password in Jadon's `.env`). Pushing `main` to `jadonli09/rung` deploys prod; `red0-x/Rung` stays the team remote. Prod lookup from a seeded number: ~0.5 s.
- **Files / endpoints touched:** `vercel.json`, `scripts/vercel-build.mjs`, `server/src/vercel.ts`, Dial account (webhook, context MCP, both numbers' inbound instruction).
- **Next:** hello call from a real phone; caller-context gaps 1–4 ([[project/caller-context]]).
