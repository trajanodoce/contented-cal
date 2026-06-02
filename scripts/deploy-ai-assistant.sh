#!/usr/bin/env bash
# Deploy the ai-assistant edge function (with the synced writing-skill content).
#
# Prereq (one-time):
#   1. Generate a Supabase Personal Access Token at:
#      https://supabase.com/dashboard/account/tokens
#   2. Export it in your shell:
#      export SUPABASE_ACCESS_TOKEN=sbp_xxx
#      (Add to ~/.zshrc to persist.)
#
# Usage:
#   bash scripts/deploy-ai-assistant.sh
#
# This wraps the Supabase CLI deploy. The function reads from
# supabase/functions/ai-assistant/ — which includes both index.ts and the
# auto-generated skill-content.ts produced by sync-writing-skill.mjs.

set -euo pipefail

PROJECT_REF="riizkhddtaacmcymbeqo"
FUNCTION_NAME="ai-assistant"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "✗ SUPABASE_ACCESS_TOKEN is not set."
  echo ""
  echo "  Generate one at https://supabase.com/dashboard/account/tokens"
  echo "  then run: export SUPABASE_ACCESS_TOKEN=sbp_xxx"
  exit 1
fi

cd "$(dirname "$0")/.."

# Re-sync skill content before deploy so we ship whatever's in the local skill files.
echo "→ Syncing writing-skill content..."
node scripts/sync-writing-skill.mjs

echo ""
echo "→ Deploying $FUNCTION_NAME to project $PROJECT_REF..."
npx -y supabase functions deploy "$FUNCTION_NAME" \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "✓ Deploy complete."
echo ""
echo "Smoke test: open any content item in ContentedCal, expand the AI Assistant,"
echo "run an action, and verify the response uses the full writing skill."
