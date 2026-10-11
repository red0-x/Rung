---
type: log
date: 2026-10-11 20:30
author: jadon
tags: [area/backend, area/voice, decision]
---
# Caller context outline: how the agent reads and keeps memory

- **Did:** wrote [[project/caller-context]]. It traces the code: identity from Dial headers, `(org_id, phone)` memory model, `lookup_caller` read path, `save_profile` / `triage_call` / webhook write paths, and what a future call sees.
- **Others need to know:** nothing changed in code or contracts. Section 7 of the note lists 8 proposed gaps (for example `lookup_caller` returns only the newest issue, unsaved callers are treated as new even with history). Any that change a tool response need a `#contract-change` entry first.
- **Files / endpoints touched:** `vault/project/caller-context.md` (new).
- **Next:** pick which gaps 1 to 4 to build before the demo, test the five phone checks in section 8 on a real call.
