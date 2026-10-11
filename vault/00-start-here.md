---
type: index
---
# Start here

One vault, one git repo, many agents. Every human and every agent reads from and writes to this vault.

## Read order

1. [[agent-protocol]] — how agents read and write here (rules)
2. [[project/overview]] — what Rung is and what the demo must show
3. [[project/contracts]] — tool names, DB schema, API shapes everyone builds against
4. [[project/architecture]] — how the parts connect
5. [[project/caller-context]] (how the agent gets caller context and remembers them next call)
6. [[team/owners]] — who owns what
7. Your area file in `areas/`
8. Newest files in `log/`

## Map

| Folder | What lives there | Who writes |
| --- | --- | --- |
| `project/` | Overview, architecture, contracts, decisions, Dial notes | Anyone, via the protocol |
| `areas/` | One file per workstream: status, requests, gotchas | That area's owner only (others add to "Requests") |
| `log/` | One file per change, never edited after | Every agent, after each meaningful change |
| `team/` | Owners and contact | Humans |
| `templates/` | Log entry and decision templates | Nobody (copy them) |
| [[open-questions]] | Unresolved questions | Anyone; owner answers inline |

## Status at a glance

- Demo freeze: 7:30 PM. Demos: 9 PM.
- Build order: hello call → enrollment + SMS code → triage + queue → brief → seed data → stretch.
