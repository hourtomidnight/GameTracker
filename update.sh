#!/bin/bash
# Runs ON THE PI. Pulls the latest from GitHub if behind, installs any new
# dependencies, and restarts the pm2-managed server. Safe to run repeatedly
# (e.g. via `npm run deploy` over SSH, or a cron job).
set -e
cd "$(dirname "$0")"

echo "Checking for updates..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Already up to date."
else
  echo "Update available - pulling latest changes..."
  # Fails loudly (not force-merging) if local commits diverge from origin -
  # that needs a human to resolve, not an auto-update script.
  git pull --ff-only
  echo "Installing dependencies..."
  npm install
fi

echo "Restarting htm-server..."
pm2 restart htm-server
pm2 logs htm-server --lines 20 --nostream
