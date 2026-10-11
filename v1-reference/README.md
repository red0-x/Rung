# Phone support with memory

Callers explain their problem once, to an AI voice agent. They verify with a text code, and every later call starts with the agent already knowing who they are. A rep gets a ranked callback queue with a written brief instead of a cold call. Built for SpeedHacks on Dial's voice agent + Context MCP.

Read `docs/ARCHITECTURE.md` for how it fits together. This file is how to get it running and what to do next.

## Run it in two minutes (no phone, no keys)

```bash
npm install
npm run dev:server        # backend on :8787, in-memory, mock Dial, two seeded returning callers
npm run dev:web           # dashboard on :5173
```

Play the part of Dial:

```bash
# new caller enrolls, then reports a $12 dispute
DEMO_SHOW_CODES=true npm run dev:server      # (restart the server with this once)
npm run simulate -- --phone +15555550111 --name "Sam" --enroll --intent dispute --amount 12 \
  --summary "Sam was charged twice for a $12 coffee order and wants one charge reversed."

# seeded returning caller reports fraud: jumps to #1
npm run simulate -- --phone +15555550101 --intent fraud_in_progress --amount 4200 \
  --summary "Reid sees unknown card charges happening right now, about $4,200 so far."
```

`npm test` runs 43 tests, including an end-to-end run that connects to `/mcp` with the same headers Dial sends. `npm run typecheck` checks both packages.

## Path to a working demo

Do these in order. Everything else hangs off step 2.

**1. Setup (15 min, everyone)**
- `cp .env.example .env`, set `MCP_SHARED_SECRET` to a long random string.
- `cp server/seed.example.json server/seed.json` and put your teammates' real numbers (E.164) in it. These are the pre-enrolled returning callers for the demo.
- Dial: `curl -fsSL https://getdial.ai/install | bash`, then `dial auth login you@email --coupon <event code>` (ask organizers for the coupon). Needs Node 22+. Put `DIAL_API_KEY` and `DIAL_NUMBER` in `.env`.

**2. The hello call (first hour). Done when the agent says your name on a real call.**
1. Start the backend and expose it: `npx cloudflared tunnel --url http://localhost:8787` (or ngrok). Dial needs a public HTTPS URL.
2. Set the agent prompt from `docs/inbound-prompt.md`: `dial number set <number> --inbound-instruction "$(cat docs/inbound-prompt.md)"`. The REST equivalent is `PATCH /api/v1/numbers/{id}` with `inboundInstruction`.
3. Connect the Context MCP at https://getdial.ai/dashboard/context-mcps with URL `https://<your-tunnel>/mcp/<MCP_SHARED_SECRET>`. The secret in the URL avoids relying on custom headers. Dial probes the URL when you connect, so the server must already be running.
4. Create the webhook at https://getdial.ai/dashboard/webhooks: target `https://<your-tunnel>/webhooks/dial`, events `call.ended` and `call.transcribed`. Copy the `whsec_...` secret into `DIAL_WEBHOOK_SECRET`, then restart.
5. Call the number from your seeded phone. Watch the server log: each tool call prints the masked caller and direction. If `caller=none`, check the header values in the log before anything else.

**3. Enrollment and verification.** Call from a number that is not seeded. Confirm the text arrives on a real phone, on each teammate's carrier. This is the most likely thing to break on the day; test it in the first hour. Fallback: `DEMO_SHOW_CODES=true` shows the code on the dashboard.

**4. Tune the agent.** Most of the remaining time goes here. Re-run `dial number set ...` after each prompt edit. Keep calls short: the free tier caps calls at 5 minutes and 2 concurrent.

**5. Seed the demo and rehearse.** Three calls: new caller with a $12 dispute, returning caller reports fraud, returning caller wants a $10M account. For the demo, raise `AGING_PER_MIN` (for example 10) so the $12 dispute's hatched bar visibly creeps. Say so on stage: it's a config value shown in the side panel.

**6. Stretch (only after 1 to 5 work).** Keewano, Alike, Darwin hooks are in `docs/ARCHITECTURE.md`. One real integration beats three half-wired ones.

## Who does what

| Owner | Starts with |
|---|---|
| A: Dial | Steps 1 and 2 above: account, number, prompt, Context MCP, webhook, tunnel |
| B: Backend | Run `npm test`, then own `server/src/mcp.ts` and `scoring.ts`. Switch to Supabase if you want persistence (below) |
| C: Dashboard | `npm run dev:web` against `npm run simulate`, no phone needed. Polish for the projector |
| D: Pitch | Demo script, slides, backup video. Lead with urgency, show aging so nobody starves |

## Deploy

- **Backend** must be a long-running process: Railway, Render, Fly, or your laptop plus a tunnel. Not Vercel functions. Set the same env vars as `.env`. With `NODE_ENV=production` it refuses to boot without `MCP_SHARED_SECRET` and `DIAL_WEBHOOK_SECRET`.
- **Dashboard** on Vercel: root `web`, build `npm run build`, env `VITE_API_BASE=https://<backend>`. Or set `WEB_DIST=../web/dist` and the backend serves it too (one URL).
- **Supabase (optional):** run `server/supabase/schema.sql` in the SQL editor, then set `STORE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Reseed with `POST /api/dev/reset`.

## Demo-day checklist

- Backend deployed (not a venue-Wi-Fi tunnel), `/api/health` shows `dial: live`, `mcpAuth: true`, `webhookVerify: true`.
- `DEMO_SHOW_CODES=true` so a lost text doesn't end the demo.
- Both pre-enrolled phones called once that morning. Dial credit topped up (a top-up also lifts the 5-minute cap).
- Backup recording of a full call. Freeze code about 90 minutes before demos.
- Cut order if behind: Darwin, Alike, Keewano, transcripts, Call back button. Never cut: the real call, the SMS code, the returning-caller greeting, the ranked queue.

## What is and isn't verified

- Verified here: typecheck, 43 tests, and a real server run driven through the MCP endpoint with Dial's headers. The Dial request shapes (messages, calls, webhook signature, Context MCP headers, number update) come from Dial's docs.
- Not verified here: a real phone call, real SMS delivery, the Supabase store against a live project, and the dashboard rendering in a browser (it builds and typechecks). Dial's docs show both `/v1/...` and `/api/v1/...` paths; the client uses `/api/v1` and `DIAL_API_BASE` changes it. `dial number set --inbound-instruction` is from the original plan; the REST `inboundInstruction` field is documented.
