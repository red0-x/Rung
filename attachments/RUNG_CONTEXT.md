# Rung: project context for Claude Code

Paste this into the repo root (rename to `CLAUDE.md` if you want Claude Code to load it automatically). It summarizes a long planning-and-build chat. Read it fully before changing code.

Status when this was written: a working single-company v1 exists (backend, MCP tools, scoring, dashboard, docs, 43 passing tests). The multi-company version described in section 7 is designed but NOT started. No code changed after v1.

---

## 1. What Rung is

Callers explain their problem once to an AI voice agent (Dial) and verify with a texted code tied to their phone number. On later calls the agent already knows who they are and what they called about. The company gets a ranked callback queue where each caller has a written brief, so reps never start cold.

- Priority = urgency (by intent) + value (dollar amount) + aging (points per minute waited, so nobody starves). Computed at read time, so the order shifts live.
- Product name: **Rung** (decided in this chat; earlier working titles "Link" and "phone support with memory" should be replaced everywhere). A quick search for existing "Rung" voice/phone products has not been done.
- New requirement from this chat: **many companies**, each with its own Rung (own Dial number, own rules, own callers, own queue). Companies log into a web dashboard to set their Rung up and work their queue.
- Backend data layer: **Supabase** (Postgres + Auth). Preferred stack: React + Supabase + Vercel. Avoid generic AI-looking UI.

## 2. Hackathon constraints (SpeedHacks)

- Core sponsor: **Dial** (getdial.ai). Stretch only: Keewano, Alike, Darwin. Sparta is skipped.
- Hacking ends 9 PM with live finalist demos. Freeze code about 90 minutes earlier (7:30 PM).
- The demo is three live phone calls: (1) new caller with a $12 card dispute, (2) returning caller reports fraud in progress, (3) returning caller wants to open a $10M account. Expected ranking: fraud #1, $10M account #2, $12 dispute #3. After 45 minutes of waiting the dispute outranks a fresh $10M account (aging).
- Never cut: the real call, the SMS code, the returning-caller greeting, the ranked queue. First milestone is the "hello call": the agent says the caller's name on a real call.
- Accepted for the demo only: each company needs its own Dial number and we do not know if numbers can be created via API, so **pre-provision two numbers** and let the setup wizard claim one. Dial free tier is 2 concurrent calls and 5-minute calls (a top-up lifts the cap). The user said this is fine for the demo.

## 3. Verdict from the feasibility review

Everything is feasible; the multi-company dashboard is the only substantial work. Supabase cannot replace our Node server: Dial's mid-call MCP calls, webhooks and OTP rate limiting need a long-running process (Railway/Render/Fly or laptop + tunnel). Supabase = Postgres + Auth. Vercel = dashboard only. Edge Functions would need a Deno rewrite; not worth it.

Estimate for the demo slice: roughly 4 to 5 hours split across two people, after the hello call works. Self-serve signup, number purchase, roles, billing and Realtime are out of scope.

## 4. Current repo (single-tenant v1)

Zip was sent earlier as `phone-support-memory.zip` (folder `speedhacks-app`). npm workspaces `server` and `web`. Node 22, Express 5, zod 4, TypeScript 7, vitest 5, Vite 8, React, `@modelcontextprotocol/sdk` 1.32.

```
server/src/
  types.ts        INTENTS, Profile, Verification, QueueItem (keyed by phone, no org)
  config.ts       env -> Config (ORG_NAME, AGING_PER_MIN, AVG_HANDLE_MIN, REPS_ON_SHIFT, DIAL_NUMBER are global today)
  identity.ts     E164, callerFromHeaders, maskPhone, safeEqual
  scoring.ts      INTENT_META + VALUE_TIERS as module constants; scoreItem(item, now, {agingPerMin,agingCap})
  queue.ts        rankQueued, toView (masks phone)
  otp.ts          6-digit code, 5 min TTL, 5 attempts, 3 sends/10 min, verified 10 min, hashed with per-process pepper
  dial.ts         real client: sendSms, getCall; mock client records sent SMS and calls
  webhook.ts      verifyDialSignature / signDialPayload
  events.ts       call.ended links callId by number + time window; call.transcribed fetches GET /calls/{id}
  mcp.ts          buildMcpServer(ctx, deps): lookup_caller, send_code, check_code, save_profile, triage_call
  app.ts          createApp: /webhooks/dial, /mcp + /mcp/:token, /api/* (UNAUTHENTICATED today)
  store/{types,memory,supabase}.ts   Store interface, in-memory impl, Supabase impl (type-checked, never run live)
  seed.ts, index.ts, sim/client.ts
server/supabase/schema.sql   profiles, verifications, queue_items, seen_events (RLS on, no policies)
server/scripts/simulate-call.ts   plays Dial against the MCP endpoint (no phone needed)
server/test/   helpers, scoring, otp, webhook, e2e (43 tests, all pass)
web/src/       App.tsx, api.ts, hooks.ts, components/{QueueRow,ScoreBar,Digits,Rules}, styles.css (polls /api/queue every 1.5s)
docs/          ARCHITECTURE.md, inbound-prompt.md (the Dial agent prompt)
```

Verified: server and web typecheck, 43 tests, a real server run driven through `/mcp` with Dial's headers. NOT verified: a real phone call, real SMS, the Supabase store against a live project, the dashboard rendered in a browser, `dial number set --inbound-instruction` (REST `PATCH /numbers/{id}` with `inboundInstruction` is the documented path).

### MCP tools (none takes a phone number; identity comes only from headers)

- `lookup_caller()` -> known, name, first_name, last_issue {summary, when}, has_open_request, guidance
- `send_code()` -> texts a 6-digit code; never returns the code to the agent. If SMS fails and DEMO_SHOW_CODES is on it still succeeds and the code shows on the dashboard.
- `check_code({code})` -> verified true/false, attempts_left
- `save_profile({name, consent})` -> requires a recent verification and explicit consent
- `triage_call({intent, amount_usd?, summary, caller_name?})` -> queues the callback. Sensitive intents (`money_movement`, `account_change`) return `verification_required` until the number passed a code check in the last 10 minutes. A repeat call within 3 minutes updates the waiting item and keeps its original createdAt. Returns position, estimated_callback_minutes, priority reason, say_to_caller.

The agent writes the brief itself via `triage_call.summary` (no LLM summarizer).

## 5. Dial facts (from Dial's docs; not yet exercised live)

- Dial gives an AI voice agent a real phone number, SMS and webhooks. **Context MCP** lets the agent call our MCP server mid-call. Every MCP request carries `X-Dial-User-Number` (caller on inbound), `X-Dial-Direction`, `X-Dial-Agent-Number` (the Dial number dialed). During tool discovery these can be missing or unsubstituted templates, so always validate (E.164 regex). Mid-call requests carry NO call id.
- Webhooks: `call.ended` data = {callId, from, to, direction, durationSeconds, status, transcriptAvailable}. `call.transcribed` data = {callId} only; fetch `GET /api/v1/calls/{id}` for `transcript`, `transcriptTurns`, `from`, `createdAt`, `duration`.
- Signature: header `X-Dial-Signature: t=<unix>,v1=<hex HMAC-SHA256 over "{t}.{rawBody}">`, secret `whsec_...`, 5-minute tolerance. Retries up to 6 times; dedupe on `X-Dial-Event-ID`. 10 second timeout, so answer 200 first and process after.
- REST: `POST /messages {to, fromNumber, body}`, `PATCH /numbers/{id} {inboundInstruction, forwardTo}`, `POST /webhooks {targetUrl, eventTypes}`, `POST /v1/context-mcps {name,url,...}`. Docs show both `/v1` and `/api/v1`; client uses `https://api.getdial.ai/api/v1`, configurable with `DIAL_API_BASE`.
- CLI: `curl -fsSL https://getdial.ai/install | bash`, `dial auth login <email> --coupon <event code>`. Dashboard pages: getdial.ai/dashboard/context-mcps and /webhooks.
- Open question: can one Dial account attach a different Context MCP URL to each number? If yes, give every company its own URL `/mcp/<org-token>`. If not, resolve the company from `X-Dial-Agent-Number`.

## 6. Trust model (keep it)

A phone number recognizes; only a texted code authorizes. No tool accepts a phone number argument. `/mcp` requires a secret (header `X-Mcp-Secret`, bearer token, or `/mcp/<secret>` in the URL). Webhooks are HMAC-verified and deduped. The dashboard list masks numbers (`+1••••••0101`); the full number is released only when a rep clicks Call back. Production refuses to boot without the MCP secret and webhook secret.

Scoring numbers (defaults): urgency fraud/medical 100, locked_out 60, payment_issue 40, money_movement 35, account_change 25, dispute 20, account_opening 20, general/other 10. Value tiers $100=8, $1k=16, $10k=24, $100k=32, $1M=40. Aging 2 points/min capped at 150. Reason string example: `Urgent: suspected fraud · $4,200 · waited 6 min · +12 aging`. Demo totals: fraud $4,200 = 116, $10M opening = 60, $12 dispute = 20.

## 7. The build: multi-company Rung on Supabase (not started)

### 7.1 Decisions

1. **Tenant = org.** Every caller profile, verification, and queue item belongs to exactly one org. Profiles are keyed `(org_id, phone)`: a caller's memory and verification at Company A must never exist at Company B. This is also a privacy selling point.
2. **Tenant resolution at call time.** Preferred: per-org MCP URL `/mcp/<org.mcp_token>` (the route already accepts a URL token; look the org up by token instead of comparing to one shared secret). Fallback: `X-Dial-Agent-Number` -> org by `dial_number`. Webhooks: `call.ended` resolves the org from `data.to` (inbound); `call.transcribed` finds the item by callId.
3. **Dashboard auth:** Supabase Auth (email + password or magic link). The dashboard calls OUR API with the user's access token; the backend verifies it and checks `org_members`. Do NOT read tables directly from the browser: that would expose full phone numbers and bypass masking and click-to-release. Keep polling; no Realtime.
4. **Per-org settings** (jsonb on `orgs`): display name, greeting/tone, scoring rules (per intent: points, tier, label, sensitive flag), value tiers, agingPerMin, agingCap, avgHandleMin, repsOnShift. The intent *enum* stays platform-wide; orgs tune its numbers.
5. **Setup wizard publishes the agent prompt:** render `docs/inbound-prompt.md` as a template from org settings (org name, greeting, callback phrasing) and push it to the org's Dial number with `PATCH /numbers/{id}` `{inboundInstruction}`. Watching the agent change as the company edits the form is the best demo moment.
6. **Numbers:** env `DIAL_NUMBER_POOL` = JSON list of `{id, number}`. The wizard "claim a number" assigns an unclaimed one to the org. SMS codes are sent from the org's number (`fromNumber`).

### 7.2 Data model (Supabase)

```
orgs(id uuid pk, name, slug unique, mcp_token unique, dial_number unique null, dial_number_id null, settings jsonb, created_at)
org_members(org_id fk, user_id uuid -> auth.users, role text default 'admin', primary key(org_id, user_id))
profiles(org_id fk, phone, name, consent_at, verified_at, created_at, primary key(org_id, phone))
verifications(org_id fk, phone, ..., primary key(org_id, phone))
queue_items(id, org_id fk, phone, ... existing columns ...)  + index (org_id, status, created_at desc)
seen_events(event_id pk)   -- global
```
RLS on for all tables; only the service-role key (server) touches them.

### 7.3 Change map (file by file, from reading the v1 code)

- `types.ts`: add `Org`, `OrgSettings`, `OrgMember`; add `orgId` to `Profile`, `Verification`, `QueueItem`.
- `store/types.ts`: every profile/verification/queue method takes `orgId` (e.g. `getProfile(orgId, phone)`, `latestQueueItemForPhone(orgId, phone, statuses?)`, `listQueueItems(orgId, opts)`). Keep `findQueueItemByCallId`, `markEventSeen`, `reset` global. Add org methods: `getOrg(id)`, `getOrgByMcpToken`, `getOrgByDialNumber`, `listOrgs`, `upsertOrg`, `updateOrg`, `getMembership(userId)`/`listMemberships`.
- `store/memory.ts`: key maps by `${orgId}:${phone}`. `store/supabase.ts`: composite keys, `onConflict: 'org_id,phone'`, org queries, then run it against a real project.
- `supabase/schema.sql`: tables above; make it re-runnable.
- `scoring.ts`: replace module constants with `defaultRules()` and pass a `Rules` object (`intents`, `valueTiers`, `agingPerMin`, `agingCap`) into `scoreItem`, `valuePoints`, `rankQueued`, `toView`. Existing scoring tests should pass with the default rules.
- `otp.ts`: methods take `orgId` (verification keyed `(orgId, phone)`); demo codes tracked per org.
- `dial.ts`: `sendSms(to, body, fromNumber)`; add `updateNumberInstruction(numberId, instruction)` -> `PATCH /numbers/{id}`; mock records both.
- `mcp.ts`: `CallerCtx` gains the resolved `org`. Replace `cfg.orgName`, `cfg.avgHandleMin`, `cfg.repsOnShift`, aging config and `INTENT_META` with `org.settings`. Every store/otp call passes `org.id`. SMS text uses the org name.
- `events.ts`: `itemForCall` scoped by org (org from `data.to`).
- `app.ts`: MCP authorize = resolve org (URL token, then agent-number fallback); keep a legacy dev shared secret only when ENABLE_DEV. Add auth middleware for `/api/*` (Supabase `auth.getUser(token)`; in dev/test accept `Authorization: Bearer dev:<email>` so everything works without Supabase). New routes: `GET /api/me`, `GET/PATCH /api/org` (settings), `POST /api/org/number` (claim from pool), `POST /api/org/publish` (render + push prompt), `GET /api/prompt-preview`. Existing queue/profiles/callback/done/transcript/dev-codes routes become org-scoped, and an item from another org must 404. `/api/health` stays public.
- `config.ts`: ORG_NAME, AGING_*, AVG_HANDLE_MIN, REPS_ON_SHIFT, DIAL_NUMBER become per-org defaults; add `DIAL_NUMBER_POOL`; Supabase JWT verification settings.
- `seed.ts`, `seed.example.json`, `index.ts`: seed two orgs (e.g. "Demo Bank" and a second company such as a clinic) with their own returning callers; print each org's MCP URL on boot.
- `sim/client.ts`, `scripts/simulate-call.ts`: `--org-token` (connects to `/mcp/<token>`) and `--agent-number`.
- `web/`: add `@supabase/supabase-js`, login page, token attached to every API call, routes `/login`, `/` (queue board), `/setup` (wizard: company name, greeting, rules, claim number, preview prompt, Publish to Dial). The Rules panel renders the org's rules. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE`.
- Rename everywhere to Rung (README, docs, dashboard header, package names, MCP server name `phone-link`, SMS text).

### 7.4 Done when

1. Two orgs exist. The same phone number called into both has separate profiles, separate verification, separate queue items (test it).
2. A user of org A cannot read, claim, or finish org B's items; `/api/*` returns 401 without a valid token.
3. Editing an org's rules changes ranking and the Rules panel for that org only.
4. The setup page's Publish button sends the rendered prompt to Dial (`PATCH /numbers/{id}`); the mock Dial records it in tests.
5. `npm run typecheck` and `npm test` pass; new tests cover tenancy isolation, token routing, auth, and the publish call.
6. The Supabase store passes the same e2e suite against a real project (`STORE=supabase`).
7. The three-call demo still ranks fraud > $10M opening > $12 dispute, per org.

### 7.5 Suggested split of work

A: Dial setup and the hello call (number, prompt, Context MCP, webhook, tunnel). B: tenant foundation (types, store, schema, scoring rules, mcp/events/app resolution, tests). C: dashboard (login, org-scoped board, setup wizard) against the API contract in 7.3. D: pitch, demo script, backup recording. B must land the API contract before C can finish; C can start with the dev token.

## 8. Dashboard design notes (keep the current look)

Cool paper `#EDF0F5`, ink `#0F1B33`, tier colors critical `#E5391F`, high `#E8A200`, normal `#2B59D9`, low `#8A97AE`. Fonts: Big Shoulders Display (headings, numerals) + Atkinson Hyperlegible Next (text), loaded from Google Fonts. Ranked ledger rows with a giant rank numeral, a score bar split into urgency (solid), value (blue), aging (hatched teal), a live waiting clock, FLIP row animation, masked phones, a "Texted codes" demo-fallback panel. Readable from the back of a room. The setup wizard should match this look and avoid generic SaaS-card styling. For the demo, `AGING_PER_MIN` can be raised (for example 10) so the $12 dispute's hatched bar visibly grows; say so on stage.

## 9. Risks and unknowns

- SMS delivery to each teammate's carrier is the most likely demo-day failure. Fallback: `DEMO_SHOW_CODES=true`.
- Supabase store and schema are untested live.
- Whether Dial supports per-number Context MCP URLs, and whether numbers can be created by API, is unknown.
- Dial REST base path (`/v1` vs `/api/v1`) is ambiguous in the docs.
- Backend must be deployed somewhere stable, not a venue-Wi-Fi tunnel, by demo time.

## 10. One-shot prompt skeleton

```
You are working in the Rung repo (read CLAUDE.md / RUNG_CONTEXT.md first).
Goal: turn the single-company v1 into multi-company Rung on Supabase (section 7).
Do, in order: schema + types + store (memory and Supabase) -> scoring rules per org -> tenant resolution in mcp/events/app -> auth + org API -> dashboard login + setup wizard -> rename to Rung -> tests and docs.
Constraints: keep the trust model (section 6); no tool takes a phone number; dashboard never reads tables directly; no new dependencies beyond @supabase/supabase-js in web; keep tests green at every step.
Finish by running typecheck and tests, then list what you could not verify.
```
