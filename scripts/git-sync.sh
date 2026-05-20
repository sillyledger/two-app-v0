#!/usr/bin/env bash
set -euo pipefail

# Safe git sync helper
# Usage: ./scripts/git-sync.sh [branch]
# - Stashes uncommitted changes (including untracked) before pulling
# - Pulls with rebase from origin/<branch>
# - Pushes current branch to origin
# - Pops stash when done

BRANCH=${1:-$(git rev-parse --abbrev-ref HEAD)}

echo "Git sync: branch=$BRANCH"

# Ensure we have remotes
git remote show origin >/dev/null 2>&1 || { echo "No origin remote configured" >&2; exit 1; }

STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Stashing local changes..."
  git stash push -u -m "autosync-$(date -u +%s)" >/dev/null
  STASHED=1
fi

echo "Fetching origin/$BRANCH..."
git fetch origin "$BRANCH"

echo "Pulling and rebasing..."
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git pull --rebase origin "$BRANCH"
else
  echo "Remote branch origin/$BRANCH does not exist — pushing local branch." 
fi

echo "Pushing $BRANCH to origin..."
git push origin "$BRANCH"

if [ "$STASHED" -eq 1 ]; then
  echo "Restoring stashed changes..."
  git stash pop || echo "Warning: failed to pop stash — please restore manually with 'git stash list'" >&2
fi

echo "Sync complete."
