#!/usr/bin/env bash
# Protege a branch main: PR obrigatório, 1 aprovação, CI verde, sem force push.
# Rode depois que o workflow de CI tiver executado pelo menos uma vez
# (os nomes dos checks só existem a partir daí).
#
#   bash scripts/proteger-main.sh            # usa o repositório atual
#   bash scripts/proteger-main.sh dono/repo
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

gh api -X PUT "repos/${REPO}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Segredos", "Lint, tipos e testes"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# Só "Squash and merge" e apaga a branch depois do merge.
gh api -X PATCH "repos/${REPO}" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null

echo "main protegida em ${REPO}."
