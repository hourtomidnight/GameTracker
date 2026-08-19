#!/bin/bash
# Runs ON THE PI, from the monorepo root (~/GameTracker). Pulls the latest
# from GitHub if behind, installs any new dependencies for whichever apps
# changed, and restarts both pm2-managed services. Safe to run repeatedly
# (e.g. via `npm run deploy` over SSH from either app, or a cron job).
set -e
cd "$(dirname "$0")"

echo "Checking for updates..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Already up to date."
else
  CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE")

  echo "Update available - pulling latest changes..."
  # Fails loudly (not force-merging) if local commits diverge from origin -
  # that needs a human to resolve, not an auto-update script.
  git pull --ff-only

  if echo "$CHANGED" | grep -q '^tracker/'; then
    echo "Installing tracker dependencies..."
    (cd tracker && npm install)
  fi
  if echo "$CHANGED" | grep -q '^roomreset/'; then
    echo "Installing roomreset dependencies..."
    (cd roomreset && npm install)
  fi
fi

echo "Restarting services..."
pm2 restart htm-server roomreset-server
pm2 logs --lines 20 --nostream
