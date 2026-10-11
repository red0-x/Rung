---
type: contract
owner: backend
version: 3
---
# Contracts (v3 · multi-tenant Rung)

Everyone builds against this file. Change it only via a `#contract-change` log entry; the backend owner applies it and bumps `version`.
Full HTTP API with field-level types: `docs/API.md` in the repo (source of truth for request/response shapes). v3 supersedes v2 ([[decisions]] D5).

## Tenancy
- **Org = tenant.** Profiles, verifications and queue items all carry `org_id`. Same phone at two orgs = two unrelated records.
- Org for a call: `/mcp/<org.mcp_token>`, or `/mcp` + `X-Dial-Agent-Number` → org by `dial_number`. Dial Context MCPs are account-wide, so production uses one `/mcp` URL with header `X-Mcp-Secret`.

## MCP tools (Dial Context MCP)
No tool takes a phone number. Caller = `X-Dial-User-Number` (E.164; missing or `{{template}}` = unknown). No LLM calls inside tools.

| Tool | Args | Returns |
| --- | --- | --- |
| `lookup_caller` | — | `{known, name, first_name, name_source, last_issue, recent_issues[≤3], call_count, previous_calls, has_open_request, open_request:{summary,status,position,estimated_callback_minutes}\|null, org_name, guidance}` |
| `send_code` (only if `REQUIRE_VERIFICATION`) | — | `{sent, expires_in_minutes:5, guidance}` · errors `rate_limited`, `sms_failed` |
| `check_code` (only if `REQUIRE_VERIFICATION`) | `code` | `{verified, attempts_left?, reason?, guidance}` |
| `save_profile` | `name`, `consent`, `facts?` | `{saved, name, facts_saved, guidance}` · errors `consent_required`, `verification_required` |
| `update_profile` | `occupation?`, `employer?`, `household?`, `location?`, `language?`, `preferences?`, `note?` | `{saved, remembered, guidance}` · errors `no_profile`, `nothing_to_save` |
| `triage_call` | `intent`, `amount_usd?`, `summary`, `caller_name?` | `{queued, position, estimated_callback_minutes, estimated_callback_at, confirmation_text_sent, priority, say_to_caller, guidance}` · also sends the ETA text once · `verification_required` for sensitive intents without a code check in the last 10 min |

`lookup_caller` also returns `facts` (saved callers) and `missing_facts`. DB adds `profiles.facts jsonb, facts_updated_at` and `queue_items.eta_minutes, eta_at, sms_status, sms_sent_at, sms_error` (migration `20261011210000`). Org setting `timezone` (IANA) drives the clock time in texts. See [[log/2026-10-11-2105-red-eta-sms-and-caller-facts]].

All tools may return `org_unknown`, `caller_unknown`, `not_allowed` (non-inbound).
Intents: `fraud_in_progress, medical_emergency, locked_out, payment_issue, money_movement, account_change, dispute, account_opening, general_question, other`. Sensitive by default: `money_movement`, `account_change`.
OTP: 6 digits, hashed, 5 min TTL, 5 attempts, 3 sends / 10 min, verified for 10 min. `DEMO_SHOW_CODES` (default on) shows codes on the dashboard: SMS to non-Dial phones is blocked until 10DLC ([[dial]]).

## Scoring (per org, computed at read time)
`score = urgency(intent) + value(amount) + min(minutes_waiting × agingPerMin, agingCap)`
- Urgency: fraud/medical 100, locked_out 60, payment_issue 40, money_movement 35, account_change 25, dispute 20, account_opening 20, general/other 10.
- Value tiers: $100=8, $1k=16, $10k=24, $100k=32, $1M=40. Aging 2/min, cap 150. All editable per org in `/setup`.
- Demo: fraud $4,200 = 116, $10M opening = 60, $12 dispute = 20. After 45 min the dispute beats a fresh $10M opening.
- Reason: `Urgent: suspected fraud · $4,200 · waited 6 min · +12 aging`.
- Time saved per caller = `baselineHoldMin (23) + reexplainMin (3) if returning`.

## Database (Supabase Postgres, project `Rung`)
Migration `supabase/migrations/20261011200000_rung_multitenant.sql`. RLS on, no policies: only the server (service role) touches tables.

```
orgs(id, name, slug uq, mcp_token uq, dial_number uq, dial_number_id uq, settings jsonb, published_at, created_at)
org_members(org_id, user_id → auth.users, role, pk(org_id,user_id))
profiles(org_id, phone, name, consent_at, verified_at, created_at, pk(org_id,phone))
verifications(org_id, phone, code_hash, expires_at, attempts, window_start, issue_count, verified_until, pk(org_id,phone))
queue_items(id, org_id, phone, agent_number, name, intent, amount_usd, summary, trust, is_returning, status,
            created_at, claimed_at, done_at, call_id, transcript, transcript_turns, duration_seconds)
seen_events(event_id pk, seen_at)
```

## HTTP API (summary; details in `docs/API.md`)
Auth: `Authorization: Bearer <Supabase access token>` (dev: `dev:<email>`). 401 no token · 403 `no_org` · 404 other org's ids.
- `GET /api/health` (public) · `GET /api/me` · `POST/GET/PATCH /api/org` · `GET /api/numbers` · `POST /api/org/number`
- `GET|POST /api/prompt-preview` · `POST /api/org/publish` (→ Dial `PATCH /numbers/{id}` `{inboundInstruction}`)
- `GET /api/queue` · `GET /api/queue/:id/transcript` · `POST /api/queue/:id/callback` (only place the full number is returned) · `POST /api/queue/:id/done`
- `GET /api/profiles` · `GET /api/dev/codes` · `GET /api/dev/dial-log` · `POST /api/dev/reset`
- `POST /webhooks/dial`: HMAC `t=,v1=`, 5 min tolerance, dedupe `X-Dial-Event-ID`, 200 before processing. `call.ended` → org from `data.to`; `call.transcribed` → fetch call, store transcript.

## Env (`.env`, gitignored; full list in `.env.example`, `docs/DEPLOY.md`)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DIAL_API_KEY`, `DIAL_API_BASE`, `DIAL_NUMBER_POOL`, `DIAL_WEBHOOK_SECRET`, `MCP_SHARED_SECRET`, `PUBLIC_URL`, `CORS_ORIGIN`, `DIAL_MOCK`, `DEMO_SHOW_CODES`. Never put values in the vault.
