---
type: log
date: 2026-10-11 15:25
author: jadon
tags: [area/backend, area/voice, contract-change]
---
# Agent now always collects + confirms the caller's name #contract-change

- **Did:** prompt step "Getting their name" (ask first + last; spell and read back long/unusual names; accept refusal). `triage_call` returns `name_missing: true` + guidance when no name; re-calling within 3 min fills the name on the same item. `save_profile` backfills the open item's name. Live on prod, both numbers re-published (verified on Dial). 91 tests.
- **Others need to know:** call order is now: understand issue → name → `triage_call(caller_name)` → offer to remember → callback ETA. Nameless earlier callers get asked their name on the next call.
- **Files / endpoints touched:** `docs/inbound-prompt.md`, `server/src/mcp.ts`, store, `docs/API.md`.
- **Next:** test call to +1 618 464 4253 with a long name; dashboard priority-color polish landing.
