# Rung: one-shot build prompt

Paste everything below the line into a fresh Claude Code session at the repo root.

---

You are building **Rung** for the SpeedHacks hackathon (today, Oct 11 2026). Code freeze is 7:30 PM and live demos start at 9 PM. Work fast, keep scope tight, and don't stop to ask unless you're truly blocked.

## Read first, in this order
1. `CLAUDE.md`: team rules. Run `scripts/vault-catchup.sh` before you start.
2. `attachments/RUNG_CONTEXT.md`: the full product spec. **It is the source of truth.** Where it disagrees with the vault, it wins, and you update the vault (see "Vault" below).
3. `attachments/Rung Brand Essentials.png`: the brand. It **replaces** the palette and fonts in RUNG_CONTEXT section 8.
   `attachments/hero-ref-collage.png` and `attachments/hero-ref-phone.png` are the aesthetic for the landing hero. Open them.
4. `vault/project/dial.md` and `vault/project/contracts.md`.

## What Rung is (one paragraph)
A caller explains their problem once to a Dial AI voice agent and verifies with a texted code. On later calls the agent already knows them. The company gets a ranked callback queue, with a written brief for each caller. Priority = urgency + dollar value + aging, computed when the queue is read. Many companies, each with its own Rung (own Dial number, rules, callers, queue), sign in to a dashboard to set it up and work the queue. Tagline: **"Your time, returned."** Subline: *Remembered callers. Callbacks instead of hold music.*

## Judging (build for this)
Problem & time saved 40 · Technical execution 25 · Market 15 · Originality 10 · Product quality & demo 10. The brief says "Give people their time back" and "Show the difference: compare before and after, measure time saved." So the dashboard shows a **time-saved counter**: per caller, the minutes they didn't spend on hold or re-explaining, with a visible, explainable formula.

## State of the repo
- The v1 code is copied into `v1-reference/` (read-only). It's rudimentary. Lift what's useful (Dial client, webhook HMAC, OTP, MCP wiring, simulate-call, FLIP hook, tests), but don't follow it strictly. Build the real app at the repo root as npm workspaces `server/` and `web/`. Delete `v1-reference/` at the end.
- **Supabase Auth is already configured**: email + password, email confirmation off, site URL `http://localhost:5173`, redirects allowed for localhost and `*.vercel.app`. Two confirmed demo users exist: `DEMO_BANK_EMAIL` and `DEMO_CLINIC_EMAIL`, sharing `DEMO_PASSWORD`, all in `.env`. The seed links them to their orgs in `org_members` (look up user ids by email with the admin API). Also support sign-up: a new user with no org lands on `/setup`, which creates the org and makes them admin.
- Dial values in `.env` (possibly still blank): `DIAL_API_KEY`, `DIAL_WEBHOOK_SECRET`, `DIAL_NUMBER_POOL` (JSON list of `{id, number}`), `DIAL_API_BASE`. See the mock rules below.
- The Supabase project **Rung** (ref `extcunuakefchqgvwzzz`, us-east-1) exists and is linked (`supabase/`). `.env` already has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`. Never print or commit them.
- Migration `supabase/migrations/20261011190000_init_link_schema.sql` holds an interim single-tenant schema. The tables are empty. Supersede it with a **new** migration that drops those three tables and creates the multi-tenant model from RUNG_CONTEXT section 7.2. Do not edit the old migration. Apply with `supabase db push`.

## Stack (fixed)
- **server/**: Node 22, TypeScript, Express 5, zod, `@modelcontextprotocol/sdk` (Streamable HTTP), `@supabase/supabase-js`, vitest. One long-running process: MCP + webhooks + JSON API. This can't be Supabase Edge Functions or Vercel (RUNG_CONTEXT section 3).
- **web/**: Vite + React + TypeScript + `@supabase/supabase-js` (Auth only). Deploys to Vercel. It talks only to our API, with the user's access token, and never reads tables directly.
- No other new dependencies unless they save real time.

## Dial credentials may not exist yet: build so that doesn't matter
The Dial key, webhook secret and number pool may still be blank in `.env` when you start. **Do not wait for them and do not ask for them.**
- Pick the Dial client at boot: real if `DIAL_API_KEY` is set, otherwise the mock. The mock records SMS sends, `PATCH /numbers` calls and `GET /calls`, so tests and the dashboard can show them.
- If `DIAL_NUMBER_POOL` is empty, use two fake numbers (`+15550000001`, `+15550000002`) flagged `mock: true`. The wizard shows "mock number" beside them.
- In mock mode, force `DEMO_SHOW_CODES=true` so texted codes appear on the dashboard.
- Allow a missing `DIAL_WEBHOOK_SECRET` only in dev. Production still refuses to boot without it.
- `scripts/simulate-call.ts` stands in for a real phone: `--org-token`, `--from +1...`, and a scripted conversation that calls the tools in order. Add `npm run demo:sim`, which replays the three demo calls (RUNG_CONTEXT section 2) against the running server so the queue fills.
- Show a small "Dial: mock" / "Dial: live" badge in the dashboard header.

## Phase A: build everything against the mock (finish and commit each step before starting the next)
1. **Schema + store + seed.** Multi-tenant tables (7.2) as a new migration, applied with `supabase db push`. A `Store` interface with memory and Supabase implementations. Seed two orgs ("Demo Bank" and a clinic), each with its own returning callers, and link the demo users. Print each org's MCP URL on boot.
2. **MCP server + hello-call path.** `lookup_caller`, identity from `X-Dial-User-Number` (E.164-validated; ignore missing values and unsubstituted templates), org from `/mcp/<org.mcp_token>` with `X-Dial-Agent-Number` as fallback. Prove it with the simulator: a seeded caller gets greeted by name.
3. **All five MCP tools** as in RUNG_CONTEXT section 4. Sensitive intents need a verification from the last 10 minutes. OTP: hashed codes, TTL, attempt and send limits.
4. **Scoring per org.** Defaults from section 6. Demo check: fraud $4,200 = 116, $10M opening = 60, $12 dispute = 20. Ranking: fraud > $10M > $12. After 45 minutes of waiting, the dispute beats a fresh $10M opening.
5. **Webhooks.** `/webhooks/dial` with HMAC `t=,v1=` verification, a 5-minute tolerance, dedupe on `X-Dial-Event-ID`, and a 200 response before any processing. `call.transcribed` fetches the call and stores the transcript. Test with self-signed payloads.
6. **API + auth.** Supabase JWT verified on `/api/*` (dev mode accepts `Bearer dev:<email>`). Org-scoped routes from section 7.3. An item from another org returns 404. Full phone number only on "Call back".
7. **Landing + dashboard.** `/` is the public landing page (see "Landing hero"); `/login`; `/queue` is the queue board; `/setup` is the wizard: company name, greeting, rules, claim a number from the pool, live prompt preview, **Publish to Dial** (`PATCH /numbers/{id}` with `inboundInstruction`; in mock mode, show the recorded payload). Polls every 1.5 s, no Realtime.
8. **Agent prompt** `docs/inbound-prompt.md`, written as a template the wizard renders.
9. **Tests**: scoring, OTP, webhook signature, tenancy isolation (same phone, two orgs, fully separate data), auth 401/404, and the publish call recorded by the mock. `npm run typecheck && npm test` must stay green.
10. **Deploy notes** in `docs/DEPLOY.md`: server on Railway/Render/Fly, web on Vercel, the env var list.

Phase A is done when `npm run demo:sim` fills the bank's queue in the right order on the dashboard, signed in as the bank demo user, with zero Dial credentials, and the landing hero at `/` matches the references' aesthetic.

## Phase B: go live with Dial (only once the keys are in `.env`; otherwise write the checklist and stop)
Write `docs/GO_LIVE.md`, an exact click-by-click checklist, then run whatever parts you can:
1. Put the server on a stable public URL and post it in `vault/areas/backend.md`.
2. Verify the API base (`/v1` vs `/api/v1`) with one harmless GET and fix `DIAL_API_BASE`.
3. Register the webhook (`POST /webhooks`, `call.ended` + `call.transcribed`) at `<PUBLIC_URL>/webhooks/dial`.
4. Register the Context MCP per org (`POST /v1/context-mcps`, URL `<PUBLIC_URL>/mcp/<mcp_token>`). If per-number URLs aren't supported, use one URL and resolve the org via `X-Dial-Agent-Number`.
5. Claim a real number in the wizard and Publish. Confirm the instruction landed on the number.
6. Hello call: a human calls the number and hears their name. Then a real SMS code.

The hello call is the first live milestone. If time runs short, cut from the bottom of Phase A, steps 10 back to 8. Never cut: the SMS code flow, the returning-caller greeting by name, the ranked queue.

## Design (brand essentials override RUNG_CONTEXT section 8)
- **Colors:** Ink `#111111`, Ivory `#F7F7F2` (page background), Cobalt `#345CFF` (primary, links, active state, "normal" tier). Keep functional tier colors: critical `#E5391F`, high `#E8A200`, low `#8A97AE`. Green dot for "Ready for callback".
- **Type:** Inter only (Google Fonts). Heavy, tight-tracked weights (800–900, letter-spacing about -0.03em) for headings and the giant rank numerals. Regular for body text. Tabular numerals for scores and clocks.
- **Logo:** use the "Rung" wordmark in Inter 900 until a real SVG arrives. Leave a `web/src/assets/logo.svg` placeholder. Header layout follows the brand sheet's "Product UI": logo · "Priority queue" · "● Ready for callback".
- **Shape language:** cobalt pill shapes (fully rounded bars) from the supporting pattern. Use them in the score bars and as a sparse decorative motif on the login screen. Nowhere else.
- **Queue board:** a ranked ledger, not cards. Each row: giant rank numeral, caller name with masked phone, intent label, amount, a score bar split into urgency (solid tier color), value (cobalt), and aging (hatched), a live waiting clock, the brief, and the reason string. Rows animate when they reorder (FLIP). Readable from the back of a room. Also show the "Texted codes" demo-fallback panel and the time-saved counter.
- Avoid generic SaaS styling: no gradient hero, no shadow-heavy card grid, no emoji. Restraint: ivory, ink, one cobalt accent.

## Landing hero (match the references' aesthetic, in Rung's brand)
Take the *aesthetic* from the two hero references, not their colors or fonts. Recolor everything to the brand: ivory background, ink, cobalt, plus at most one tier color as a small accent.
- **Layout:** a huge centered headline, **"Your time, returned."** (Inter 900, tight tracking, ~clamp(56px, 9vw, 128px)). Subline: *Remembered callers. Callbacks instead of hold music.* Then one input + button row: "Work email" + ink "Get started" pill → `/login?signup`. Top nav: logo, small centered links (How it works · For teams · Pricing), "Log in" text link, ink "Get started — it's free" pill.
- **Centerpiece:** a phone frame below the headline showing a live Rung call, built in HTML/CSS (not an image): "Incoming · +1 ••• 0101", "Welcome back, Maria", a 6-digit code bubble, then "Callback in ~6 min". Behind it, a large soft **cobalt pill/blob** (the brand's supporting-pattern shape), as in the yellow blob in the phone reference.
- **Floating fragment cards scattered around it** (the collage reference): real UI fragments, slightly offset, a few rotated 1–3°, thin 1px ink-10% borders, almost no shadow:
  - A mini ranked queue: three rows with rank numerals 1/2/3, tier dots, and score bars (fraud · $10M opening · $12 dispute).
  - A big stat tile with a **light, oversized numeral** (Inter 200–300, like "1231 HOURS" in the reference): "0 min on hold" or "1,231 minutes returned". One tile in cobalt with ivory text, one in ivory.
  - Intent chips, like the filter chips: "Suspected fraud ×", "Locked out +", "Open account +", with one in cobalt and one in an ink outline.
  - A caller brief card: name, masked phone, a 2-line brief, "Ready for callback ●".
  - A "Verified ✓" badge in a scalloped/seal shape (cobalt with an ivory check), echoing the green checkmark seal.
- **Hand-drawn accents:** 2–3 thin curved SVG arrows linking cards to the phone, a short underline swash under "returned", and small tick-mark sparkles near a card. All ink, about 1.5px stroke.
- **Motion:** cards drift in on load (staggered, 300–500ms, ease-out, 8–16px translate). Respect `prefers-reduced-motion`.
- **Below the hero (keep it short):** a "Before / after" strip (on hold 23 min, explained 3 times → 0 min on hold, explained once, called back in 6 min). It feeds the judging's "show the difference." Then 3 numbered steps (Call · Verify · Get called back) and a footer. No testimonials, logos wall or pricing table.
- **Responsive:** on mobile the cards stack under the phone, and the arrows hide.

## Vault (team protocol, required)
- RUNG_CONTEXT changes the contract: tool args, the scoring model, multi-tenant tables, and renaming Link → Rung. Write a `#contract-change` log entry, bump `vault/project/contracts.md` to **v3** to match what you actually build, add decision D5 "Multi-tenant Rung, org = tenant" to `vault/project/decisions.md`, and rename Link → Rung across the vault.
- Update `vault/areas/backend.md` Status as steps land. Post the public URL there when deployed.
- Push vault changes by committing only the vault files you touched. Don't sweep up `vault/.obsidian/` personal settings.

## Hard rules
- Trust model from RUNG_CONTEXT section 6: no tool takes a phone number; a phone number recognizes, only a code authorizes; mask numbers in lists.
- MCP tools answer fast, with no LLM calls inside them.
- No secrets in git or the vault. Production refuses to boot without the MCP and webhook secrets.
- Commit after each step with a clear message.

## Finish
Run typecheck and tests, then report whether Phase B ran or is waiting on keys, and: what works (with evidence), what you couldn't verify (real call, real SMS, Dial per-number MCP URLs, `/v1` vs `/api/v1`), and the exact steps a teammate must take in the Dial dashboard to get the hello call working.
