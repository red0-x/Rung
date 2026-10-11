---
type: contract
owner: backend
version: 1
---
# Contracts

Everyone builds against this file. Change it only via a `#contract-change` log entry; the backend owner applies it and bumps `version`.

## MCP tools (Link backend, connected to Dial as a Context MCP)

The caller is never a tool argument: read it from the `X-Dial-User-Number` header on every request. Only ever return data for that number.

| Tool | Args | Returns |
| --- | --- | --- |
| `lookup_caller` | — | `{found, name?, last_issue?, verified}` |
| `send_code` | — | `{sent}` — texts a 6-digit code via Dial, expires in 10 min |
| `check_code` | `code` | `{verified}` |
| `save_profile` | `name`, `notes?` | `{ok}` — refused unless verified this call |
| `triage_call` | `intent`, `category` (`fraud` \| `lockout` \| `new_account` \| `dispute` \| `other`), `amount_usd`, `urgency` (1 low – 3 high), `summary` | `{call_id, rank, eta_min}` |

Tools must answer fast (no LLM calls inside them): silence on a phone call is awkward.

## Database (SQLite, `data/link.db`)

```sql
profiles(phone TEXT PRIMARY KEY, name TEXT, notes TEXT, verified_at TEXT, created_at TEXT)
calls(id INTEGER PRIMARY KEY, phone TEXT, dial_call_id TEXT, intent TEXT, category TEXT,
      amount_usd REAL, urgency INTEGER, summary TEXT, brief TEXT, reason TEXT,
      status TEXT DEFAULT 'queued',  -- queued | called_back | done
      created_at TEXT)
otps(phone TEXT PRIMARY KEY, code TEXT, expires_at TEXT)
```

## Scoring

`score = urgency * 100 + value_pts + minutes_waiting * 2`

- `value_pts`: < $1K = 0, < $100K = 20, < $1M = 40, ≥ $1M = 60
- `reason` string example: `Urgent: fraud, $4,200 · waited 6 min`
- Computed at read time so waiting keeps adding points.

## HTTP API (backend)

| Method | Path | Body / returns |
| --- | --- | --- |
| GET | `/api/queue` | queued calls sorted by score desc: `[{id, name, phone_last4, category, amount_usd, score, reason, brief, waited_min}]` |
| POST | `/api/calls/:id/status` | `{status}` |
| POST | `/webhooks/dial` | Dial events `call.ended`, `call.transcribed`. Verify the HMAC signature. On `call.transcribed`, write `brief` (3 lines). |

## Env (`.env`, gitignored)

`DIAL_API_KEY`, `DIAL_NUMBER`, `DIAL_WEBHOOK_SECRET`, `PUBLIC_URL`, `PORT`
