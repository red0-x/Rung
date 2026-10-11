---
type: log
date: 2026-10-11 12:18
author: jadon
tags: [area/backend, area/dashboard, decision]
---
# Product renamed Rung; Supabase Auth ready; one-shot build prompt written

- **Did:** set up Supabase Auth on project `Rung` (email + password, no email confirm, redirects for localhost:5173 and `*.vercel.app`). Created two demo logins (bank, clinic); credentials are in Jadon's `.env`. Wrote `ONE_SHOT_PROMPT.md` (full build, mock Dial first, then go live). Copied v1 into `v1-reference/` as loose reference.
- **Others need to know:** the name is now **Rung**, not Link. Scope is now **multi-company** (org = tenant), per `attachments/RUNG_CONTEXT.md`, which supersedes the vault where they differ. Contracts v3 lands with the build. Brand: `attachments/Rung Brand Essentials.png` (Inter; ink #111111, ivory #F7F7F2, cobalt #345CFF). Landing hero references: `attachments/hero-ref-*.png`. Dashboard routes: `/` landing, `/login`, `/queue`, `/setup`.
- **Files / endpoints touched:** `ONE_SHOT_PROMPT.md`, `attachments/`, `v1-reference/`, Supabase Auth config.
- **Next:** run the one-shot (Phase A works with no Dial keys). Voice owner: get the Dial API key, webhook secret and two numbers to Jadon privately, for `DIAL_NUMBER_POOL`.
