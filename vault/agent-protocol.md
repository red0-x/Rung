---
type: rules
---
# Agent protocol

How every agent (and human) shares context through this vault. The vault lives in the team git repo; git is the sync.

## The loop

1. **Catch up** — `scripts/vault-catchup.sh`. Pulls, then prints every vault file changed since your last catch-up, with diffs.
2. **Read what changed** — new `log/` entries first, then any change to `project/contracts.md` or `project/decisions.md`.
3. **Work** inside your area, against [[project/contracts]].
4. **Write back** — log entry, area Status, decision if any.
5. **Push** — `scripts/vault-push.sh "summary"`. Commits only `vault/`, rebases, pushes.

Catch up at session start, before each new task, and whenever your human says "sync".

## What goes where

| You learned / did… | Write it in |
| --- | --- |
| Finished or changed something | New file in `log/` (template: [[templates/log-entry]]) |
| Your area's progress or blocker | Your file in `areas/` → Status |
| Need something from another area | That area's file → Requests (append one line) |
| A choice everyone must follow | [[project/decisions]] (template: [[templates/decision]]) |
| Want to change a tool, field, table or endpoint | Log entry tagged `#contract-change`; owner of [[project/contracts]] applies it |
| A question nobody has answered | [[open-questions]] |
| A Dial quirk or gotcha | [[project/dial]] → Gotchas |

## Why it doesn't conflict

- Log entries are new files with unique names: `YYYY-MM-DD-HHMM-<owner>-<slug>.md`. Two agents never edit the same log file.
- Each area file has one owner. Others only append under Requests.
- Shared files (`contracts`, `decisions`, `open-questions`) are append-mostly. If a rebase conflicts, keep both sides and tell your human.

## Writing rules

- Short. Bullets and tables, facts and decisions. No essays, no restating other notes: link them with `[[note]]`.
- Tag log entries: `#area/voice` `#area/backend` `#area/dashboard` `#area/stretch`, plus `#contract-change`, `#blocker`, `#decision` when they apply.
- Never edit or delete someone else's log entry or area Status. Correct it with a new log entry.
- No secrets, keys, phone numbers of real people, or OTP codes in the vault.
