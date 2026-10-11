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
| GET | `/api/me` | | `{user:{id,email}, org: OrgView\|null, role:'admin'\|null, platform:{dial:'mock'\|'live', demoShowCodes:boolean, enableDev:boolean}}` (never 403) |
| POST | `/api/org` | `{name}` | `201 {org}`. Creates org with default settings, caller becomes admin. `409 already_member` |
| GET | `/api/org` | | `{org}` |
| PATCH | `/api/org` | `{name?, settings?: Partial<OrgSettings>}` (intents may be partial per key) | `{org}`; `400 invalid` on zod failure |
| GET | `/api/numbers` | | `{numbers:[{id, number, mock, available:boolean, mine:boolean}]}` (pool from `DIAL_NUMBER_POOL`) |
| POST | `/api/org/number` | `{numberId}` | `{org}`; `409 number_taken`; `404` unknown id. Claiming a new one releases the old one |
| GET | `/api/prompt-preview` | | `{prompt}` rendered from saved settings |
| POST | `/api/prompt-preview` | `{name?, settings?}` draft (not saved) | `{prompt}` |
| POST | `/api/org/publish` | | `{ok:true, mock:boolean, numberId, number, request:{method:'PATCH', path:'/numbers/<id>', body:{inboundInstruction}}}`; `400 no_number` |
| GET | `/api/queue` | | `QueueResponse` (below) |
| GET | `/api/queue/:id/transcript` | | `{transcript:string\|null, turns:[{speaker,text}]\|null}` |
| POST | `/api/queue/:id/callback` | | `{phone, tel}` and status → `in_progress` |
| POST | `/api/queue/:id/done` | | `{ok:true}` |
| GET | `/api/profiles` | | `{profiles:[{name, phoneMasked, createdAt, verified:boolean}]}` |
| GET | `/api/dev/codes` | | `{codes:[{phoneMasked, code, expiresAt}]}` this org only; `404` unless `demoShowCodes` |
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

- `POST /mcp/<org.mcp_token>` (preferred). `POST /mcp` falls back to `X-Dial-Agent-Number` → org by `dial_number`. Unknown → 401.
- Caller identity only from `X-Dial-User-Number` (E.164; missing / `{{template}}` values = unknown caller).
- Tools: `lookup_caller()`, `send_code()`, `check_code({code})`, `save_profile({name, consent})`, `triage_call({intent, amount_usd?, summary, caller_name?})`. Shapes per `attachments/RUNG_CONTEXT.md` §4.

## Webhooks

`POST /webhooks/dial`: HMAC `X-Dial-Signature: t=<unix>,v1=<hex>` over `"{t}.{rawBody}"`, 5-min tolerance, dedupe `X-Dial-Event-ID`, 200 before processing.
