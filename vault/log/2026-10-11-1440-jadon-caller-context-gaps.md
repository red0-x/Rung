---
type: log
date: 2026-10-11 14:40
author: jadon
tags: [area/backend, area/voice, contract-change]
---
# Caller-context gaps 1–4 built and live #contract-change

- **Did:** `lookup_caller` gained `recent_issues` (last 3), `call_count`, `previous_calls` (history but no saved profile), name fallback from earlier calls (`name_source`), and `open_request` {position, ETA}. Additive only. Prompt updated; both numbers re-published. 84 tests.
- **Others need to know:** agent now says "your callback is #N, about M minutes" and greets unsaved repeat callers with "Welcome back" (no unconfirmed names). Gaps 5–8 in [[project/caller-context]] still open. That note's §8 checks 1 and 4 assume texted codes; with D6 they don't apply.
- **Files / endpoints touched:** `server/src/mcp.ts`, store, `docs/inbound-prompt.md`, `docs/API.md`; Dial inbound instructions on both numbers.
- **Next:** hello call on +1 618 464 4253.
