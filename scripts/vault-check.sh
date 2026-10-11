#!/usr/bin/env bash
# Runs on every prompt (UserPromptSubmit hook). Fetches only — never touches your files.
# Prints one line if teammates pushed vault changes you haven't pulled.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
git rev-parse -q --verify '@{u}' >/dev/null || exit 0
t=""; command -v timeout >/dev/null && t="timeout 5"   # macOS has no timeout by default
$t git fetch -q 2>/dev/null || exit 0
n=$(git rev-list --count 'HEAD..@{u}' -- vault/ 2>/dev/null)
[[ ${n:-0} -gt 0 ]] && echo "vault: $n new teammate change(s). Run scripts/vault-catchup.sh before continuing."
exit 0
