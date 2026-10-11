# Go live with Dial (Phase B checklist)

Status: Dial key and one real pool number are in `.env`; nothing below has been run against Dial by the server agent
(no real SMS sent, no real number patched). Work top to bottom; each step says how to confirm it.

Known facts (from Dial docs and the coordinator's live check):
- `GET /numbers` returns 200 on both `https://api.getdial.ai/api/v1` and `/v1`. Keep `DIAL_API_BASE=https://api.getdial.ai/api/v1`.
- A Context MCP attaches to the whole **account's** agent, not to one number. So register **one** MCP URL,
  `<PUBLIC_URL>/mcp`, with a static header `X-Mcp-Secret: <MCP_SHARED_SECRET>`. The server picks the org from
  `X-Dial-Agent-Number` (the number dialed). Per-org `/mcp/<token>` URLs still work but aren't needed.
- **SMS only reaches other Dial numbers today.** Texts to regular phones need 10DLC registration (not available at the
  event). So `send_code` will likely fail to deliver to a real caller. Fallback (on by default, `DEMO_SHOW_CODES=true`):
  `send_code` still succeeds, the code appears in the dashboard's "Texted codes" panel (`GET /api/dev/codes`), and the
  caller reads it from the screen. Say so on stage.

## 1. Public URL

1. Deploy the server per `docs/DEPLOY.md` with `NODE_ENV=production`, `PUBLIC_URL=https://<server>`, `DIAL_API_KEY`,
   `DIAL_NUMBER_POOL`, `MCP_SHARED_SECRET` (generate: `openssl rand -hex 24`), and a placeholder
   `DIAL_WEBHOOK_SECRET` (replace in step 3).
2. Confirm: `curl https://<server>/api/health` returns `"store":"supabase","dial":"live"`.
3. Post the URL in `vault/areas/backend.md`.

## 2. Verify the API base (harmless GET)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $DIAL_API_KEY" https://api.getdial.ai/api/v1/numbers
```
Expect `200`. If not, try `https://api.getdial.ai/v1/numbers` and set `DIAL_API_BASE` to whichever answers.

## 3. Register the webhook

Dashboard: getdial.ai/dashboard/webhooks, then **Add endpoint**:
- URL `https://<server>/webhooks/dial`
- Events: `call.ended`, `call.transcribed`
- Save, copy the signing secret (`whsec_...`), set it as `DIAL_WEBHOOK_SECRET` on the server, redeploy.

(API alternative: `POST /webhooks {"targetUrl":"https://<server>/webhooks/dial","eventTypes":["call.ended","call.transcribed"]}`.)
Confirm: use **Send test event** if offered; the server log shows the event, and an unsigned `curl -X POST https://<server>/webhooks/dial -d '{}'` returns 401.

## 4. Register the Context MCP (one per account)

Dashboard: getdial.ai/dashboard/context-mcps, then **Add**:
- Name `rung`
- URL `https://<server>/mcp`
- Static header: `X-Mcp-Secret` = the `MCP_SHARED_SECRET` value
- Save. Dial runs tool discovery: the server log shows `mcp [no-org] tools/list` and the five tools appear
  (`lookup_caller`, `send_code`, `check_code`, `save_profile`, `triage_call`). During discovery the agent-number header
  is missing or a template, so the server answers with no org; that is expected.

(API alternative: `POST https://api.getdial.ai/v1/context-mcps {"name":"rung","url":"https://<server>/mcp", ...headers}`.)
If the dashboard has no static-header field, register `https://<server>/mcp/<MCP_SHARED_SECRET>` instead (the URL
token is accepted as the secret, org still comes from the agent number).

## 5. Claim the real number and publish

1. Sign in to the dashboard as the bank demo user, open **Setup**.
2. **Claim** the real pool number (`+15717200334`); it is not marked "mock number".
3. Edit greeting/rules, check the live prompt preview, click **Publish to Dial**. The server sends
   `PATCH /numbers/<id> {"inboundInstruction": "<rendered docs/inbound-prompt.md>"}`.
4. Confirm: the response says `"mock": false`; in the Dial dashboard the number's inbound instruction shows the
   rendered prompt (or `dial number set` / `GET /numbers/<id>` shows it).

## 6. Hello call (first live milestone)

1. From a teammate's phone, call `+15717200334`.
2. If that phone is not a seeded caller, the agent asks what's going on. Answer, say yes to saving details, read the
   code from the dashboard's **Texted codes** panel (SMS likely won't arrive, see above), and give your name.
3. Hang up, call again: the agent greets you by first name. **That's the hello call.**
4. Confirm on the dashboard: the queue shows your item with a brief; after `call.ended` / `call.transcribed` the row gets
   a duration and a transcript.

For the scripted demo, put teammates' real numbers in the bank as returning callers (or let them enroll on a first
call), then make the three calls: $12 dispute (new caller), fraud in progress $4,200 (returning, verifies by code),
$10M account opening (returning). Queue order: fraud (116) > $10M (60) > $12 (20).

## 7. Real SMS (only if Dial enables it)

If 10DLC becomes available or the caller's phone is a Dial number: call, trigger `send_code`, confirm the text arrives
from the org's number reading `Demo Bank: your verification code is ######...` (plain ASCII). To require real SMS,
set `DEMO_SHOW_CODES=false` (then a failed send makes the agent offer to continue without saving).

## Troubleshooting

- `401` on `/mcp` in the log: header missing or wrong secret, or the dialed number isn't claimed by any org.
- Tools return `org_unknown` mid-call: the number dialed isn't claimed in Setup (or `X-Dial-Agent-Number` isn't sent).
- Tools return `caller_unknown`: Dial didn't send `X-Dial-User-Number` as E.164.
- Webhook `401 stale_timestamp`: server clock skew; `bad_signature`: wrong `DIAL_WEBHOOK_SECRET`.
