---
type: decisions
---
# Decisions

Newest first. Append with [[templates/decision]]. Never edit an old one; supersede it.

## D10 · Pitch framing: "Gmail Priority Inbox for phone support" (supersedes the Link one-liner)
- One-liner: *Rung is Gmail Priority Inbox for phone support.* Tagline: *Never on hold. Never a stranger.* "Stripe Link for phone support" and "Your time, returned" are retired (Link covered memory only; every project here uses "time back").
- Four points: nobody holds · the right call first · the rep never starts cold · never a stranger. Script: `docs/pitch.md`.
- Owner: Jadon · 2026-10-11

## D9 · www.tryrung.today is the main site
- Old `rung-liart.vercel.app` pages 307 to www; `/api`, `/mcp`, `/webhooks` keep working on both hosts so Dial's registered URLs don't break mid-demo. Move Dial's MCP + webhook to www after the demo.
- Owner: Jadon · 2026-10-11

## D8 · One login, several orgs; teammates added by email invite
- `X-Org-Id` header picks the org per request (sidebar switcher, stored in localStorage); falls back to the oldest membership, never grants access. Invites by email become memberships on the person's next `/api/me`, so nobody's password is handled for them.
- Why: the team (Jadon, Conrad, Reid) needs both demo orgs without six plus-address accounts.
- Owner: Jadon · 2026-10-11

## D7 · Several reps per org: pull-based claims, one login each
- A callback is claimed with a compare-and-set on `status='queued'`; the loser gets `409 already_claimed`. Reps press **Take next** (server hands out the top unclaimed caller, one open callback each) instead of the server pushing calls. Only the claimer or an admin can finish/cancel. Presence = dashboard heartbeat; callback estimates divide by reps online.
- Every rep has their own login (demo: Gmail plus-addresses + `DEMO_BANK_REPS`). Invite codes come after the demo.
- Why: modeled on Zendesk Talk (first agent to accept a callback wins; routing by availability). Our score already decides order, so pull beats push.
- Owner: Jadon · 2026-10-11

## D6 · Ship without the texted code (supersedes the SMS part of D2 for now)
- `REQUIRE_VERIFICATION=false` by default: no `send_code` / `check_code` tools, `save_profile` needs consent only, sensitive intents queue normally and the agent won't discuss details until the callback. Trust shown is recognized/new, never "verified".
- Why: outbound SMS to US phones is blocked until 10DLC clears (3–5 business days). Code paths stay behind the flag; set it to `true` once registered.
- Owner: team (Jadon) · 2026-10-11

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
