---
type: log
date: 2026-10-11 21:00
author: jadon
tags: [area/backend, area/dashboard, area/voice, contract-change]
---
# BUILT (items 1–3): multiple reps per org (safe claims, Take next, rep count, invites) #contract-change

Approved by Jadon and built on branch `multi-rep` (items 1–3; invites deferred). Contracts v4, D7. Modeled on Zendesk Talk: callbacks offered to all agents, first to accept wins; routing by availability + capacity.

- **Problem:** `POST /api/queue/:id/callback` doesn't check status and `queue_items` has no `claimed_by`, so two reps can claim and call the same caller. There's also no way to add a second user to an org (only `POST /api/org` → new org, caller = admin).
- **Proposed changes:**
  1. `queue_items.claimed_by uuid → auth.users` (null when queued). Claim = one conditional update `... WHERE id=$id AND status='queued'`; zero rows → `409 already_claimed {claimed_by_name}`. Release/Done allowed for the claimer or an admin only (`403 not_claimer`). `GET /api/queue` items gain `claimed_by:{id,name}|null`.
  2. `POST /api/queue/next` → atomically claims the highest-score queued item for the caller, returns `{item, phone, tel}` or `204` if the queue is empty. Limit 1 open claim per rep (`409 at_capacity`).
  3. Rep presence: `available_reps` = members seen in the last 60 s with no open claim (heartbeat = queue poll). `GET /api/queue` returns `available_reps`. `estimated_callback_minutes` (and the ETA text from red's 2026-10-11 entry) divides by `max(1, available_reps)`.
  4. Invites: `orgs.invite_code` (random, rotatable). `POST /api/org/join {code}` → member with role `rep`. Admin sees the code in `/setup`. One login per rep; no shared emails.
- **Demo shortcut (item 4 can wait):** use Gmail plus-addresses (`<inbox>+sam@`, `<inbox>+alex@`) as separate Supabase accounts, then add them with `insert into org_members (org_id, user_id, role) select '<org id>', id, 'rep' from auth.users where email in (...)`. Two windows (normal + incognito), one rep each. Build the invite code after the demo.
- **Others need to know:** voice: wording of the callback estimate doesn't change, only the number. Dashboard: claimed rows show "<name> is calling…", plus a Take next button and an "N reps available" pill.
- **Later (not in this proposal):** skills per rep matched to intent; auto-release a claim after ~15 min with no Done.
- **Built as:** ETA uses reps *online* (not just free), falling back to `repsOnShift` when nobody has the dashboard open. Plain Call back may exceed the 1-callback limit (only Take next enforces it), like Zendesk's manual override. New env `DEMO_BANK_REPS` (comma-separated, users must have signed up) seeds reps instead of hand SQL. Migration `20261011220000_multi_rep.sql`. 115 server tests.
- **Next:** invite code; auto-release stale claims; skills routing.
