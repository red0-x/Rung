---
type: log
date: 2026-10-11 12:35
author: jadon
tags: [area/backend, area/dashboard, contract-change, decision]
---
# Contract v3 proposed: multi-tenant Rung (Link → Rung) #contract-change

- **Did:** started the one-shot build. Workspaces `server/` + `web/` scaffolded; API contract written in `docs/API.md` (v3). Vault renamed Link → Rung; added D5.
- **Others need to know:**
  - Tables move to orgs, org_members, profiles `(org_id, phone)`, verifications `(org_id, phone)`, queue_items (org_id), seen_events. Old `profiles/calls/otps` are dropped by a new migration.
  - MCP tools change: `triage_call({intent, amount_usd?, summary, caller_name?})` (intent enum, no category/urgency), `save_profile({name, consent})`, `check_code({code})`. Still no phone-number args.
  - Scoring: urgency by intent + value tiers + 2 pts/min aging (cap 150), per-org rules. Demo: fraud $4,200 = 116, $10M opening = 60, $12 dispute = 20.
  - MCP URL is per org: `/mcp/<mcp_token>`. API is `/api/*` with Supabase bearer token, org-scoped.
- **Files / endpoints touched:** `docs/API.md`, `package.json`, `server/`, `web/`, vault overview/architecture/decisions.
- **Next:** server, dashboard and landing being built in parallel; `contracts.md` bumps to v3 when the server lands.
