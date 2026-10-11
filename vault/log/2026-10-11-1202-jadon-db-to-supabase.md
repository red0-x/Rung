---
type: log
date: 2026-10-11 12:02
author: jadon
tags: [area/backend, contract-change, decision]
---
# Contract v2: database moves from SQLite to Supabase Postgres

- **Did:** created Supabase project `Rung` (us-east-1), applied migration `20261011190000_init_link_schema.sql` (same 3 tables: `profiles`, `calls`, `otps`). Bumped [[project/contracts]] to v2, added D4 in [[project/decisions]] (supersedes D1), updated [[project/architecture]].
- **Others need to know:** MCP tools, `/api/queue` and webhooks are unchanged. Types are now Postgres (`timestamptz`, `numeric`, identity `id`); `category`, `urgency`, `status` have CHECK constraints. New env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Get them from Jadon, not the vault. `data/link.db` is no longer used.
- **Files / endpoints touched:** `supabase/` (config + migrations), contracts, decisions, architecture.
- **Next:** backend code connects to Supabase with the service-role key; seed data goes in as a migration or a seed script.
