#!/usr/bin/env bash
# boot.sh — One-command Space-Agent-OS launcher
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$REPO_ROOT/apps/core/logs"

# ── Flags ──────────────────────────────────────────────────────────────────
NO_DASHBOARD=false
NO_AGENTS=false

for arg in "$@"; do
  case "$arg" in
    --no-dashboard) NO_DASHBOARD=true ;;
    --no-agents)    NO_AGENTS=true ;;
    *) echo "Unknown flag: $arg" && exit 1 ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────
ok()   { echo "  [ok]  $*"; }
warn() { echo "  [!!]  $*"; }
info() { echo "  [..]  $*"; }

port_in_use() { lsof -iTCP:"$1" -sTCP:LISTEN -t &>/dev/null; }
proc_running() { pgrep -f "$1" &>/dev/null; }

mkdir -p "$LOGS_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Space-Agent-OS Boot Sequence"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. .env check ──────────────────────────────────────────────────────────
info "Checking .env ..."
if [[ -f "$REPO_ROOT/.env" ]]; then
  ok ".env found"
else
  warn ".env not found at $REPO_ROOT/.env — some services may fail to start"
fi

# ── 2. Ollama check ────────────────────────────────────────────────────────
info "Checking Ollama ..."
if curl -sf http://localhost:11434/api/tags &>/dev/null; then
  ok "Ollama is running"
else
  warn "Ollama not detected on port 11434 — start it with: ollama serve"
fi

# ── 3. OpenClaw check ─────────────────────────────────────────────────────
info "Checking OpenClaw (port 18789) ..."
if port_in_use 18789; then
  ok "OpenClaw is running on port 18789"
else
  warn "OpenClaw not detected on port 18789 — run: openclaw"
fi

echo ""

# ── 4. Dashboard ──────────────────────────────────────────────────────────
if [[ "$NO_DASHBOARD" == false ]]; then
  info "Starting dashboard (apps/dashboard) ..."
  if port_in_use 3000; then
    ok "Port 3000 already in use — skipping dashboard start"
  else
    (cd "$REPO_ROOT/apps/dashboard" && pnpm dev >> "$LOGS_DIR/dashboard.log" 2>&1) &
    ok "Dashboard started → logs: $LOGS_DIR/dashboard.log"
  fi
fi

# ── 5. Heartbeat agent ────────────────────────────────────────────────────
if [[ "$NO_AGENTS" == false ]]; then
  info "Starting heartbeat agent ..."
  if proc_running "agents.heartbeat"; then
    ok "Heartbeat agent already running"
  else
    (cd "$REPO_ROOT/apps/core" && uv run python -m agents.heartbeat >> "$LOGS_DIR/heartbeat.log" 2>&1) &
    ok "Heartbeat agent started → logs: $LOGS_DIR/heartbeat.log"
  fi

  # ── 6. MCP server ─────────────────────────────────────────────────────
  info "Starting MCP server ..."
  if proc_running "agent_mcp.server"; then
    ok "MCP server already running"
  else
    (cd "$REPO_ROOT/apps/core" && uv run python -m agent_mcp.server >> "$LOGS_DIR/mcp_server.log" 2>&1) &
    ok "MCP server started → logs: $LOGS_DIR/mcp_server.log"
  fi
fi

echo ""

# ── 7. Verify ignition ────────────────────────────────────────────────────
info "Running verify_ignition.py ..."
(cd "$REPO_ROOT/apps/core" && uv run python verify_ignition.py) || warn "verify_ignition.py exited with errors"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Services"
echo "  Dashboard  → http://localhost:3000"
echo "  OpenClaw   → http://localhost:18789"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
