# Rung API contract (v3)

The server (`server/`) and dashboard (`web/`) both build to this file. Change it only together.

- Server listens on `PORT` (default **8787**). Web dev server on **5173** proxies `/api` to it.
- All JSON. Timestamps are **epoch milliseconds** (numbers). Money in whole USD (number).
- Phones are E.164. Lists only ever carry `phoneMasked` (`+1••••••0101`). The full number is returned only by `POST /api/queue/:id/callback`.

## Auth

- `/api/health` is public. Everything else under `/api/*` needs `Authorization: Bearer <token>`.
- `<token>` = the Supabase access token (`session.access_token`). Server verifies with `supabase.auth.getUser(token)`.
- Dev/test only (`ENABLE_DEV`, never in production): `Bearer dev:<email>` is accepted as that user. `dev:<DEMO_BANK_EMAIL>` is a member of Demo Bank, `dev:<DEMO_CLINIC_EMAIL>` of the clinic, in both memory and Supabase stores.
- Errors: `401 {error:"unauthorized"}` (missing/bad token) · `403 {error:"no_org"}` (signed in, no org yet: send the user to `/setup`) · `404 {error:"not_found"}` (unknown id **or another org's id**) · `400 {error:"<code>", message?}` · `409 {error:"<code>"}`.

## Types

```ts
type Intent = 'fraud_in_progress' | 'medical_emergency' | 'locked_out' | 'payment_issue' | 'money_movement'
  | 'account_change' | 'dispute' | 'account_opening' | 'general_question' | 'other';
type Tier = 'critical' | 'high' | 'normal' | 'low';
type Trust = 'verified' | 'recognized' | 'new';
type QueueStatus = 'queued' | 'in_progress' | 'done';

interface IntentRule { label: string; points: number; tier: Tier; sensitive: boolean }
interface ValueTier { minUsd: number; points: number }

interface OrgSettings {
  greeting: string;          // first line the agent says, e.g. "Thanks for calling Demo Bank."
  tone: string;              // e.g. "warm, brief, plain English"
  intents: Record<Intent, IntentRule>;
  valueTiers: ValueTier[];   // ascending by minUsd
  agingPerMin: number;       // default 2
  agingCap: number;          // default 150
  avgHandleMin: number;      // default 4
  repsOnShift: number;       // default 1
  baselineHoldMin: number;   // default 23  (industry hold time we replace; feeds time saved)
  reexplainMin: number;      // default 3   (minutes a returning caller would spend re-explaining)
}

interface OrgView {
  id: string; name: string; slug: string;
  dialNumber: string | null; dialNumberId: string | null; dialNumberMock: boolean;
  mcpUrl: string;            // `${PUBLIC_URL}/mcp/${mcp_token}`
  settings: OrgSettings;
  publishedAt: number | null;
}

interface QueueItemView {
  id: string; rank: number | null; name: string | null; phoneMasked: string;
  intent: Intent; intentLabel: string; tier: Tier; tierLabel: string;
  amountUsd: number | null; summary: string; trust: Trust; returning: boolean;
  status: QueueStatus; createdAt: number; claimedAt: number | null; doneAt: number | null;
  waitedMin: number;
  score: { urgency: number; value: number; aging: number; total: number };
  reason: string;            // "Urgent: suspected fraud · $4,200 · waited 6 min · +12 aging"
  savedMin: number;          // baselineHoldMin + (returning ? reexplainMin : 0)
  hasTranscript: boolean; durationSeconds: number | null;
}
```

Tier labels: critical "Critical", high "High", normal "Normal", low "Low".

## Routes

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | | `{ok, store:'memory'\|'supabase', dial:'mock'\|'live', time}` |
| GET | `/api/me` | | `{user:{id,email}, org: OrgView\|null, role:'admin'\|null, platform:{dial:'mock'\|'live', demoShowCodes:boolean, enableDev:boolean, requireVerification:boolean}}` (never 403) |
| POST | `/api/org` | `{name}` | `201 {org}`. Creates org with default settings, caller becomes admin. `409 already_member` |
| GET | `/api/org` | | `{org}` |
| PATCH | `/api/org` | `{name?, settings?: Partial<OrgSettings>}` (intents may be partial per key) | `{org}`; `400 invalid` on zod failure |
| GET | `/api/numbers` | | `{numbers:[{id, number, mock, available:boolean, mine:boolean}]}` (pool from `DIAL_NUMBER_POOL`) |
| POST | `/api/org/number` | `{numberId}` | `{org}`; `409 number_taken`; `404` unknown id. Claiming a new one releases the old one |
| GET | `/api/prompt-preview` | | `{prompt}` rendered from saved settings |
| POST | `/api/prompt-preview` | `{name?, settings?}` draft (not saved) | `{prompt}` |
| POST | `/api/org/publish` | | `{ok:true, mock:boolean, numberId, number, request:{method:'PATCH', path:'/numbers/<id>', body:{inboundInstruction}}}`; `400 no_number`; `502 dial_failed` if Dial rejects it |
| GET | `/api/queue` | | `QueueResponse` (below) |
| GET | `/api/queue/:id/transcript` | | `{transcript:string\|null, turns:[{speaker,text}]\|null}` |
| POST | `/api/queue/:id/callback` | | `{phone, tel}` and status → `in_progress` |
| POST | `/api/queue/:id/done` | | `{ok:true}` |
| GET | `/api/profiles` | | `{profiles:[{name, phoneMasked, createdAt, verified:boolean}]}` |
| GET | `/api/dev/codes` | | `{codes:[{phoneMasked, code, expiresAt}]}` this org only; `404` unless `demoShowCodes` and `requireVerification` |
| GET | `/api/dev/dial-log` | | `{mock:boolean, sms:[{toMasked, from, body, at}], patches:[{numberId, at, inboundInstruction}], callFetches:[{callId, at}]}` this org only |
| POST | `/api/dev/reset` | | `{ok:true}` reseeds (ENABLE_DEV only, else 404) |

```ts
interface QueueResponse {
  now: number;
  queued: QueueItemView[];        // ranked, rank = 1..n
  inProgress: QueueItemView[];
  done: QueueItemView[];          // last 6 within 12h
  stats: { waiting: number; inProgress: number; longestWaitMin: number; avgWaitMin: number };
  timeSaved: {
    totalMin: number; callers: number;      // over queued + inProgress + done (today)
    baselineHoldMin: number; reexplainMin: number; returningCallers: number;
    formula: string;  // "23 min hold avoided per caller + 3 min re-explaining avoided per returning caller"
  };
}
```

## MCP (Dial Context MCP)

- `POST /mcp/<org.mcp_token>`, or `POST /mcp` with org resolved from `X-Dial-Agent-Number` → org by `dial_number`. Unknown → 401.
- Dial attaches one Context MCP per account, so production uses `POST /mcp` with static header `X-Mcp-Secret: <MCP_SHARED_SECRET>` (bearer or `/mcp/<MCP_SHARED_SECRET>` also accepted). Required when the secret is set; production won't boot without it. A missing/templated agent number (tool discovery) is allowed with the secret: tools list fine, tool calls return error `org_unknown`.
- Caller identity only from `X-Dial-User-Number` (E.164; missing / `{{template}}` values = unknown caller).
- Tools: `lookup_caller()`, `send_code()`, `check_code({code})`, `save_profile({name, consent})`, `triage_call({intent, amount_usd?, summary, caller_name?})`. Shapes per `attachments/RUNG_CONTEXT.md` §4.
- `lookup_caller()` returns (additive; one round of parallel store reads, no LLM):
  ```ts
  { known: boolean;                       // has a saved profile at this org
    name: string|null; first_name: string|null;
    name_source: 'profile'|'previous_call'|null;   // previous_call = caller_name from an earlier triage, unconfirmed
    last_issue: {summary, when}|null;      // newest item, any status
    recent_issues: {summary, intent, intent_label, when, status}[];   // newest 3
    call_count: number;                    // all queue items for this number at this org
    previous_calls: number|null;           // = call_count when there is no profile, null when known
    has_open_request: boolean;
    open_request: {summary, status:'queued'|'in_progress', position:number|null, estimated_callback_minutes:number|null}|null;
    org_name: string; guidance: string }   // guidance = what to say next (welcome back / confirm name / callback #N, ~M min)
  ```
- `triage_call` returns `{queued, position, estimated_callback_minutes, priority, name_missing, say_to_caller, guidance}`. `name_missing: true` when the item has no name (no saved profile, no `caller_name`): it is still queued, and guidance tells the agent to ask for the name and call `triage_call` again with `caller_name` (a repeat within 3 min updates the same item, keeps `createdAt`, never erases a name). `caller_name` is whitespace-normalized and title-cased only if all lower/upper case. `save_profile` also backfills the name on the caller's open item if it has none.
- `REQUIRE_VERIFICATION` (server env, default **false**): when false, `send_code`/`check_code` are not listed, `save_profile` needs consent only, `triage_call` never returns `verification_required`, trust is only `recognized`/`new`, and `platform.demoShowCodes` is false. When true: texted-code flow as above.

## Webhooks

`POST /webhooks/dial`: HMAC `X-Dial-Signature: t=<unix>,v1=<hex>` over `"{t}.{rawBody}"`, 5-min tolerance, dedupe `X-Dial-Event-ID`, 200 before processing.
