#!/bin/bash
# Space-Claw Discord Bot — shell wrapper for LaunchAgent
# Ensures .env is loaded and PATH is correct

export PATH="/Users/trevspace/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/trevspace"

CORE="/Users/trevspace/Space/active-projects/space-agent-os/apps/core"

# Load .env
set -a
source "$CORE/.env"
set +a

cd "$CORE"
exec "$CORE/.venv/bin/python" "$CORE/start_discord_bot.py"
