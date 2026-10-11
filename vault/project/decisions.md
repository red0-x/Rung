---
type: decisions
---
# Decisions

Newest first. Append with [[templates/decision]]. Never edit an old one; supersede it.

## D5 · Multi-tenant Rung, org = tenant
- Every profile, verification and queue item belongs to exactly one org; profiles keyed `(org_id, phone)`, so a caller's memory at Company A never exists at Company B.
- Org resolved per call from `/mcp/<org.mcp_token>`, fallback `X-Dial-Agent-Number`. Each org claims a Dial number from a pre-provisioned pool and publishes its own agent prompt.
- Dashboard = Supabase Auth + our API (user token, org-scoped, cross-org ids 404). Browser never reads tables.
- Why: product is many companies each with its own Rung (`attachments/RUNG_CONTEXT.md` §7). Supersedes the single-tenant parts of contracts v2.
- Owner: backend · 2026-10-11

## D4 · Supabase Postgres is the backend DB (supersedes D1)
- Why: hosted, shared by the whole team, no local DB file to lose; still behind the same tool/API contract.
- Owner: backend · 2026-10-11

## D3 · Callbacks instead of live transfer
- Why: Dial has no mid-call transfer; callbacks also kill hold time, which is the pitch.
- Owner: team · 2026-10-11

## D2 · Phone number recognizes, SMS code authorizes
- Why: caller ID can be spoofed. Sensitive actions always need a fresh code.
- Owner: team · 2026-10-11

## D1 · SQLite first, Keewano only as stretch
- Why: zero setup; swap later behind the same contract.
- Owner: backend · 2026-10-11
