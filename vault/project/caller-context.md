---
type: project
---
# Caller context: how the agent learns who is calling, and remembers them next time

Status: describes the code in `server/src/` as of 2026-10-11 20:25. Section 7 lists proposed gaps, not built.
Related: [[contracts]] · [[architecture]] · [[dial]] · [[areas/voice]] · [[areas/backend]]

## 1. The idea in one line

A phone number **recognizes**, a texted code **authorizes**. The agent never receives or sends a phone number. The server reads the number from Dial's headers, so the agent can only ever touch the person on the line, at the company they called.

## 2. Three things identify every request

| Fact | Where it comes from | Used for |
| --- | --- | --- |
| Who is calling | `X-Dial-User-Number` header (E.164) | the caller key `phone` |
| Which company was dialed | URL token `/mcp/<mcp_token>`, else `X-Dial-Agent-Number` header | the tenant key `org_id` |
| Direction | `X-Dial-Direction` (`inbound` only allowed when `REQUIRE_INBOUND=true`) | block outbound abuse |

- Code: `callerFromHeaders` in `server/src/identity.ts`. It validates against `^\+[1-9]\d{6,14}$`. Missing values and unsubstituted `{{template}}` strings become `null`.
- During Dial's tool discovery the headers are missing. The server answers `tools/list` with no org. Any tool call without a valid org or phone returns `org_unknown` or `caller_unknown`, and the agent apologizes.
- Mid-call requests carry **no call id**. Tying a call to a queue item happens after the call (section 5).

## 3. The memory model

Everything about a person is keyed `(org_id, phone)`. The same phone at two companies is two unrelated records. This is a privacy selling point and is tested.

| Table | Key | What it remembers | Written by |
| --- | --- | --- | --- |
| `profiles` | `(org_id, phone)` | `name`, `consent_at`, `verified_at`, `created_at` | `save_profile` |
| `queue_items` | `id`, indexed by `(org_id, phone)` | every request: `intent`, `amount_usd`, `summary` (the brief), `trust`, `is_returning`, `status`, timestamps, `call_id`, `transcript`, `transcript_turns`, `duration_seconds` | `triage_call`, then webhooks |
| `verifications` | `(org_id, phone)` | hashed code, attempts, `verified_until` (10 minute window) | `send_code`, `check_code` |

Two kinds of memory:
- **Identity memory**: the profile. Exists only if the caller said yes to saving. Gives the name.
- **History memory**: past queue items. Exists for anyone who got triaged, saved or not. Gives "last issue".

## 4. Reading context: what happens at the start of a call

1. Caller dials the company number. Dial's agent starts with the org's published prompt (`docs/inbound-prompt.md`, rendered per org).
2. Prompt rule: the first action is `lookup_caller`, with no arguments, before any question.
3. Server (`mcp.ts`) resolves org + phone from headers, then runs three store reads in parallel:
   - `getProfile(org, phone)`
   - `latestQueueItemForPhone(org, phone)` (any status) gives the last issue
   - `latestQueueItemForPhone(org, phone, ['queued','in_progress'])` gives an open request
4. Response to the agent:

```json
{
  "known": true,
  "name": "Maria Lopez",
  "first_name": "Maria",
  "last_issue": { "summary": "Card charged twice for $12 ...", "when": "yesterday" },
  "has_open_request": false,
  "org_name": "Demo Bank",
  "guidance": "Greet them by first name and ask whether this is about their last issue or something new."
}
```

5. The `guidance` string tells the model exactly what to say next. Branches:
   - **known + last_issue**: "Welcome back, Maria. Is this about [last issue], or something new?"
   - **known + open request**: mention the pending callback, ask if it is the same thing.
   - **unknown**: say the org greeting, ask what happened, offer to save details later.

Design rules for this read:
- No LLM inside tools. Plain DB reads, so the answer returns in well under a second.
- The summary shown to the agent is the brief a previous agent wrote, so the agent reads its own past notes.
- `relativeDay` turns timestamps into "earlier today", "yesterday", "N days ago" so the agent can say them aloud.

## 5. Writing context: how it persists for next time

| Moment | Tool or event | What is stored | Rule |
| --- | --- | --- | --- |
| Caller agrees to be remembered | `send_code` then `check_code` then `save_profile {name, consent}` | profile row, `verified_at` set only if a code passed | `consent` must be true. With `REQUIRE_VERIFICATION=true`, a passed code is required. Consent alone never marks verified. |
| Issue understood | `triage_call {intent, amount_usd?, summary, caller_name?}` | queue item with the agent-written brief, `trust` = `verified` / `recognized` / `new`, `is_returning` | Repeat call from the same number within 3 minutes updates the waiting item instead of adding a duplicate, keeps original `created_at`. |
| Call ends | webhook `call.ended` | `call_id`, `duration_seconds` on the item | Org from `data.to`. Item found by org + caller number + created during the call (60 s slack). |
| Transcript ready | webhook `call.transcribed` | `transcript`, `transcript_turns` | Server fetches `GET /calls/{id}`. Item found by `call_id`, else same window match. |

`is_returning` is true only if the profile existed **before** this call, not if it was saved during it. That feeds the time-saved counter.

## 6. How a future session gets it

Next call from the same number to the same company:
1. Same header read gives same `(org_id, phone)`.
2. `lookup_caller` finds the profile (name) and newest queue item (last issue).
3. Agent greets by name and picks up the thread. Caller explains nothing twice.
4. New `triage_call` creates a fresh queue item, so history grows by one row per request.
5. The rep sees the brief, the trust level, and "returning" on the dashboard.

Same number at a different company: empty result, treated as new. Nothing leaks.

Trust ladder (set at triage time):
- `verified`: passed a texted code in the last 10 minutes.
- `recognized`: has a saved profile, no recent code.
- `new`: neither.
Sensitive intents (`money_movement`, `account_change` by default) need `verified`, otherwise `triage_call` returns `verification_required` and the agent runs the code steps, then retries.

## 7. Known gaps and proposals (not built, need owner OK)

Tag for anything that changes a tool response: `#contract-change`.

1. **Only the newest issue is returned.** A caller with 5 past calls shows one. Proposal: add `recent_issues` (last 3: summary, intent, when, status) and `call_count` to `lookup_caller`. Pure read, no schema change.
2. **Unsaved callers still have history.** `last_issue` works for anyone triaged, but `known` is false, so the agent treats them as new and ignores the history. Proposal: add `previous_calls: n` and a guidance branch "you have spoken before but have no saved name".
3. **Name capture.** `caller_name` on `triage_call` is stored on the queue item only, not the profile. Fine, but `lookup_caller` ignores it for unsaved callers. Proposal: fall back to the last queue item's `name`.
4. **Open request detail.** `has_open_request` is a boolean. Proposal: include the open item's summary and queue position so the agent can say "your callback is next".
5. **Resolved outcome.** When a rep marks an item `done`, nothing captures the outcome. Proposal: optional `resolution` note on `done`, surfaced as `last_issue.outcome` ("refunded", "card replaced").
6. **Transcripts are stored but never read back.** Deliberately: tools must stay fast and no LLM runs inside them. Option: a summarizer job after `call.transcribed` that rewrites a durable `profile.notes` (2 lines), read by `lookup_caller`. Stretch only.
7. **Call to item matching is heuristic** (number + time window). Two calls from one number inside a minute can cross-link. Acceptable for the demo. If Dial ever exposes a call id mid-call, key on it.
8. **Retention and deletion.** ✅ 2026-10-11: admin **Forget caller…** on Callers (`DELETE /api/callers/:key`). Keewano events already sent are not recalled. Was: No "forget me" path yet. Needed for the privacy story: a delete-by-`(org, phone)` route that removes profile, verifications, and queue items.

## 8. Demo checks (what to verify on a real phone)

1. First call from a new phone: agent says the org greeting, you explain, accept saving, read the code from the dashboard "Texted codes" panel, give a name. Queue shows a `new` or `verified` item.
2. Hang up, call again within a minute: agent says "Welcome back, <first name>" and mentions the last issue.
3. Call the **other** company's number from the same phone: agent treats you as new.
4. Ask for a wire or account change while only `recognized`: agent must run the code steps before it queues.
5. After hangup, the dashboard row gains a duration, then a transcript.
