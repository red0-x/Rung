---
type: log
date: 2026-10-11 15:35
author: jadon
tags: [area/backend, area/voice, area/dashboard]
---
# Demo orgs renamed: Bank of Antarctica, Mango Clinic

- **Did:** renamed live orgs via `PATCH /api/org` (name + greeting) and re-published both prompts. Seed, tests, simulator and docs updated. Slugs unchanged (`demo-bank`, `northside-clinic`).
- **Others need to know:** +1 618 464 4253 = **Bank of Antarctica**, +1 571 720 0334 = **Mango Clinic**. Use these names in the pitch and demo script. Logins unchanged (`bank@rung.demo`, `clinic@rung.demo`).
- **Files / endpoints touched:** `server/src/seed.ts`, `server/test/*`, `scripts/simulate-call.ts`, `docs/*`, live orgs, Dial inbound instructions.
- **Next:** —
