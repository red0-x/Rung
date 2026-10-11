# Link — agent instructions

You are one of several Claude Code agents on a 4-person hackathon team (SpeedHacks, Oct 11 2026, demos at 9 PM).
We're building **Link**: Stripe Link for phone support. Callers explain once, verify with an SMS code, and every
later call starts with the agent already knowing them. A priority queue ranks calls for human callback.

The team's shared brain is the Obsidian vault in `vault/`. It is the source of truth for scope, contracts and
decisions. Other teammates' agents write to it while you work.

## Every session, before you write code

1. Run `scripts/vault-catchup.sh`. It pulls and shows every vault change since you last looked.
2. Read `vault/00-start-here.md`, then `vault/agent-protocol.md` (first session only).
3. Read `vault/project/contracts.md` and your owner's area file in `vault/areas/`.
4. Read any new files in `vault/log/` that the catch-up showed.

## While you work

- Build to `vault/project/contracts.md`. Do not change a tool name, field, table or endpoint on your own:
  propose it in a log entry tagged `#contract-change` and tell your human.
- Stay in your area. Need something from another area? Add it to that area's "Requests" section, don't edit their code.

## When you finish a meaningful change

1. Write a log entry in `vault/log/` (copy `vault/templates/log-entry.md`).
2. Update your area file's Status section.
3. If you made a decision others must follow, add it to `vault/project/decisions.md`.
4. Run `scripts/vault-push.sh "<one-line summary>"`.

Re-run the catch-up whenever you start a new task or your human says "sync".

## Hard rules

- Never commit secrets (Dial API key, webhook secret). Use `.env`, which is gitignored.
- Never rewrite or delete another person's log entry or area file.
- Keep vault notes short. Facts, contracts, decisions, status. No essays.
