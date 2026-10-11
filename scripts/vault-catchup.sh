#!/usr/bin/env bash
# Pull, then print every vault change since this clone's last catch-up.
# Also runs automatically at Claude Code session start (.claude/settings.json).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 0
marker="$(git rev-parse --git-dir)/vault-last-seen"   # per clone, never committed

if git rev-parse -q --verify '@{u}' >/dev/null; then
  git pull -q --rebase --autostash || echo "vault: pull failed — resolve with your human, then rerun"
fi

now=$(git rev-parse HEAD 2>/dev/null) || { echo "vault: no commits yet"; exit 0; }
since=$(cat "$marker" 2>/dev/null)

if [[ -z $since ]] || ! git cat-file -e "$since" 2>/dev/null; then
  echo "== vault: first catch-up on this clone — read vault/00-start-here.md =="
  git --no-pager log -n 15 --format='%h %an %ar  %s' -- vault/
elif [[ $since == "$now" ]]; then
  echo "vault: no new changes"
else
  echo "== vault changes since last catch-up =="
  git --no-pager log --format='%h %an %ar  %s' "$since..$now" -- vault/
  echo
  git --no-pager diff --stat "$since" "$now" -- vault/
  echo
  # shortcut: diff capped at 6000 chars so it fits a hook's context limit; read the files for the rest
  git --no-pager diff "$since" "$now" -- vault/ ':!vault/.obsidian' | head -c 6000
  echo
fi
echo "$now" > "$marker"
