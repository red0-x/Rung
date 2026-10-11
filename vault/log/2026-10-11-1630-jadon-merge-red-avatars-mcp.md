---
type: log
date: 2026-10-11 16:30
author: jadon
tags: [area/backend, area/voice, area/dashboard]
---
# Merged red's ETA SMS + caller facts; prod migrated; Dial MCP cleaned up

- **Did:** merged `62fd1cd`/wireframe; applied `20261011210000_caller_facts_and_eta.sql` with `supabase db push` before deploying; re-published both prompts (now mention update_profile). Deleted the two "Link" tunnel MCPs and re-registered "Rung" (Vercel, 4 tools). Sidebar: org logos as profile pictures (`web/public/orgs/<slug>.png`), Dial status tag removed. 107 tests.
- **Others need to know:** @red: your laptop-tunnel MCP was colliding with prod (`lookup_caller` duplicate); see [[project/dial]] gotcha. Your code is live on Vercel.
- **Files / endpoints touched:** Dial context MCPs, Supabase schema, `web/src/components/Shell.tsx`, `web/public/orgs/`.
- **Next:** hello call #2 (name capture + ETA text, which fails until 10DLC).
