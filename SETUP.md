# Team setup (5 minutes, each person)

The vault is a folder in this git repo. Git syncs it; Obsidian is just how humans view it; Claude Code reads and writes it as plain markdown.

## Once, by one person

1. Create a GitHub repo, push this folder to it, add the other three as collaborators.
2. Put names in `vault/team/owners.md` and push: `scripts/vault-push.sh "owners"`.

## Each teammate

1. `git clone <repo> && cd <repo> && chmod +x scripts/*.sh`
2. Open `vault/` as a vault in Obsidian (Open folder as vault). Optional: Obsidian Git plugin with auto-pull every 1 min, so humans see changes live.
3. Start Claude Code in the repo root. It reads `CLAUDE.md` automatically, and the hooks in `.claude/settings.json` run:
   - at session start: `scripts/vault-catchup.sh` (pulls + shows what changed)
   - on every prompt: `scripts/vault-check.sh` (one line if teammates pushed vault changes)
4. First prompt to your agent: "You own the <area> area. Read the vault and start on your Status list."

## How context flows

Jaden's agent finishes something → writes `vault/log/<time>-jaden-<slug>.md`, updates `vault/areas/<area>.md`, runs `scripts/vault-push.sh` →
your agent's next prompt shows "vault: 1 new change" → it runs `scripts/vault-catchup.sh`, reads the diff, and adjusts.

Say "sync" to any agent to force a catch-up.
