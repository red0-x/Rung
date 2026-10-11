---
type: reference
---
# Dial notes

Docs: https://docs.getdial.ai (append `.md` to any page for plain text).

## Commands

- Install: `curl -fsSL https://getdial.ai/install | bash` (Node 22+)
- Sign up: `dial auth login <email> --coupon <event code>` → `dial auth verify-otp --code <code> --agent claude-code`
- Health: `dial doctor`
- Inbound prompt: `dial number set <number> --inbound-instruction "..."`
- SMS: `dial message --to +1... --body "..."`
- Watch calls: `dial wait-for call.ended --field direction=inbound --json`
- Context MCP: `POST https://api.getdial.ai/v1/context-mcps` `{ "name": "link", "url": "<PUBLIC_URL>/mcp" }`

## Facts

- Every mid-call tool request carries `X-Dial-User-Number` (caller), `X-Dial-Agent-Number`, `X-Dial-Direction`.
- Events: `call.status_changed`, `call.ended`, `call.transcribed`, `message.received`. Use a webhook for guaranteed delivery.
- Free tier: 5-minute calls, 2 concurrent calls.
- `--forward-to` is a per-number setting, not a mid-call transfer.

## Gotchas

<!-- append: - <what happened> → <fix> (owner) -->
- SMS works **Dial-to-Dial only** today; texts to regular phones need 10DLC registration (post-hackathon). → Real callers won't receive the code; demo uses the dashboard "Texted codes" panel (`DEMO_SHOW_CODES=true`, now the default). (jadon)
- Hackathon quickstart: getdial.ai/hackathon/speedhacks/quickstart. API key in dashboard **Settings**; numbers in **Phone Numbers**; buy more with `dial number purchase`. New accounts: 5-min calls, 2 concurrent. (jadon)
- REST base: both `https://api.getdial.ai/api/v1` and `/v1` answer `GET /numbers` with 200 (verified 2026-10-11). We use `/api/v1`. (jadon)
- 10DLC is now an API: `POST /numbers/{id}/10dlc` (`kind` sole_proprietor|business, `brand`, `campaign`), $25 one-time per number from credit, `GET` for status, resubmit after rejection is free. `tenDlc.status` on `GET /numbers`: not_registered, in_review, with_carrier, approved, rejected. Inbound texts and calls are unaffected. Verified 2026-10-11: Bank number not_registered, Clinic number with_carrier. Dial-to-Dial texts deliver today (tested with the ETA text). Opt-in/out rules: getdial.ai/messaging-policies (STOP line is in every ETA text). (red)
- **Context MCPs are account-wide**, not per number: tools go to every call on the account. → Register ONE URL `<PUBLIC_URL>/mcp` with static header `X-Mcp-Secret`; server resolves the org from `X-Dial-Agent-Number`. (jadon)
- An **iMessage number** sends through the same `POST /messages` and falls back to RCS/SMS. Ask at the Dial table for one: it may get codes to real iPhones without 10DLC. (jadon)
- First real call (2026-10-11): full path worked (MCP triage → queue, `call.ended` + `call.transcribed` → duration + transcript). But the agent queued without asking the caller's name → dashboard "Unknown caller". → Prompt now requires name + spelling confirmation; `triage_call` returns `name_missing` guidance. (jadon)
- **One Context MCP only.** Dial MCPs are account-wide and tool names must be unique across them; a second MCP (e.g. a laptop tunnel) shadows or collides with prod. 2026-10-11: removed the "Link" tunnel MCPs, re-registered "Rung" → `https://rung-liart.vercel.app/mcp` (4 tools). Test new server code on a Vercel preview or prod, not by adding another MCP. After adding/renaming a tool, re-register the MCP so Dial refreshes its tool list (it caches it at connect). (jadon)
- Supabase gotcha (2026-10-11): after a migration adds columns, PostgREST can keep a stale schema cache → every API call 500s with "Could not find the '<col>' column ... in the schema cache". Fix: `supabase db query --linked "notify pgrst, 'reload schema'"`. Run it after every `db push` / GitHub-integration migration. (jadon)
