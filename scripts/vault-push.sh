#!/usr/bin/env bash
# Commit only vault/ and push. Usage: scripts/vault-push.sh "one-line summary"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
msg="${1:?usage: scripts/vault-push.sh \"summary\"}"

git add vault/
if git diff --cached --quiet -- vault/; then echo "vault: nothing to push"; exit 0; fi
git commit -q -m "vault: $msg" -- vault/

git rev-parse -q --verify '@{u}' >/dev/null || { echo "vault: committed locally (no remote set)"; exit 0; }
for _ in 1 2 3; do   # teammates push often; rebase and retry
  if git pull -q --rebase --autostash && git push -q; then echo "vault: pushed"; exit 0; fi
  git rebase --abort 2>/dev/null || true
  sleep 1
done
echo "vault: push failed (likely a conflict). Keep both sides, then rerun." >&2
exit 1
