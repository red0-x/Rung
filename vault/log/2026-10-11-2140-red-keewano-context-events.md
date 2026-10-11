---
type: log
date: 2026-10-11 21:40
author: red
tags: [area/stretch, area/backend]
---
# Keewano now sees saved caller context and the callback-time text

- **Did:** two new Keewano events beside conrad's funnel: `context_saved` (qualifier = number of fields saved; fires on `update_profile` and `save_profile` with facts) and `eta_text` (qualifier `sent` / `failed` / `skipped`). Two new Insights questions: "Caller details remembered" and "Callback time texts". Same privacy rule as before: only a pseudonymous caller id, org key and a count or status ever leave. No facts, names, summaries or phone numbers.
- **Others need to know:** `GET /api/insights` now returns 5 items instead of 3, and the Insights refresh makes 5 Keewano questions instead of 3 against the daily limit (25 unless `KEEWANO_MCP_DAILY_LIMIT=0`). Both new events use the Onboarding Milestone built-in type, so no custom event registration. `eta_text:failed` is how we will see 10DLC blocking texts in production.
- **Files / endpoints touched:** `server/src/{keewano,mcp}.ts`, `server/test/keewano.test.ts` (119 tests green).
- **Next:** confirm the two new tokens appear in Keewano after a real call; dashboard Insights strip can render the new items as-is.
