---
type: log
date: 2026-10-11 21:05
author: red
tags: [area/backend, area/voice, contract-change, decision]
---
# ETA confirmation text + durable caller facts #contract-change

- **Did:** (1) After `triage_call` saves the request, the server texts the caller once from the org number: callback minutes, clock time in the org timezone, queue position, STOP line. Promise is stored on the item (`eta_minutes`, `eta_at`, `sms_status`). A repeat `triage_call` (name backfill) does not re-text or move the time. (2) Callers who agreed to be remembered get a `profiles.facts` jsonb (occupation, employer, household, location, language, preferences, notes). New tool `update_profile`; `save_profile` takes optional `facts`; `lookup_caller` returns `facts` + `missing_facts` and guidance that tells the agent what it already knows and to ask each missing thing once. Facts survive re-saves, 20 days later, and stay per org.
- **Others need to know:** new migration `20261011210000_caller_facts_and_eta.sql` must be applied (Supabase GitHub integration applies it on push to `main`). Until then the code still works: eta/sms bookkeeping is best-effort and never fails a call. New org setting `timezone` (default `America/Los_Angeles`, not yet in the Setup UI). Prompt template changed: republish each org's prompt (`POST /api/org/publish`) so the live agent says the clock time and asks the two facts.
- **Delivery reality:** the Dial key works and a real text went out Dial-to-Dial and showed `delivered`. Bank number `+1618...` is `not_registered` for 10DLC, clinic `+1571...` is `with_carrier` (sole proprietor, pending). Until a number is approved, texts to normal US phones are blocked by carriers: Dial returns an error, the call still succeeds, `sms_status='failed'`. Registration is `POST /numbers/{id}/10dlc`, $25 per number, and the Bank number needs it too.
- **Files / endpoints touched:** `server/src/{mcp,sms,facts,types,settings,scoring}.ts`, both stores, `docs/inbound-prompt.md`, `docs/API.md`, migration, `server/test/eta-sms-facts.test.ts` (100 tests green).
- **Next:** publish prompts; register 10DLC for the Bank number; dashboard could show `sms_status` and a caller facts panel (needs a `GET /api/profiles` field, not built); "forget me" delete route still open (caller-context gap 8).
