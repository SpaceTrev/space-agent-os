#!/usr/bin/env bash
# boot.sh — Space-Agent-OS one-command launcher
# Usage: ./boot.sh [--no-dashboard] [--no-agents] [--no-api] [--discord]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$REPO_ROOT/apps/core/logs"
mkdir -p "$LOGS_DIR"

# ── Flags ──────────────────────────────────────────────────────────────────
NO_DASHBOARD=false
NO_AGENTS=false
NO_API=false
START_DISCORD=false

for arg in "$@"; do
  case "$arg" in
    --no-dashboard) NO_DASHBOARD=true ;;
    --no-agents)    NO_AGENTS=true ;;
    --no-api)       NO_API=true ;;
    --discord)      START_DISCORD=true ;;
    --help)
      echo "Usage: ./boot.sh [--no-dashboard] [--no-agents] [--no-api] [--discord]"
      exit 0
      ;;
    *) echo "Unknown flag: $arg" && exit 1 ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}[ok]${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}[!!]${RESET}  $*"; }
info() { echo -e "  [..]  $*"; }
err()  { echo -e "  ${RED}[xx]${RESET}  $*"; }

port_in_use()  { lsof -iTCP:"$1" -sTCP:LISTEN -t &>/dev/null; }
proc_running() { pgrep -f "$1" &>/dev/null; }

wait_for_port() {
  local port=$1 label=$2 retries=20
  for i in $(seq 1 $retries); do
    if port_in_use "$port"; then
      return 0
    fi
    sleep 0.5
  done
  warn "$label did not come up on :$port within ${retries} tries"
  return 1
}

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Space-Agent-OS Boot Sequence${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── 1. .env check ──────────────────────────────────────────────────────────
info "Checking environment..."
if [[ -f "$REPO_ROOT/apps/core/.env" ]]; then
  ok "apps/core/.env found"
else
  warn "apps/core/.env not found — copy apps/core/.env.example and fill in values"
fi

if [[ -f "$REPO_ROOT/apps/dashboard/.env.local" ]]; then
  ok "apps/dashboard/.env.local found"
else
  warn "apps/dashboard/.env.local not found — copy apps/dashboard/.env.local.example"
fi

# ── 2. Prereq check ────────────────────────────────────────────────────────
info "Checking prerequisites..."

# uv (Python package manager)
if command -v uv &>/dev/null; then
  ok "uv found: $(uv --version)"
elif [[ -x "/opt/homebrew/bin/uv" ]]; then
  export PATH="/opt/homebrew/bin:$PATH"
  ok "uv found (Homebrew)"
else
  err "uv not found — install: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

# Node / npm/pnpm
if command -v pnpm &>/dev/null; then
  NODE_CMD="pnpm"
  ok "pnpm found: $(pnpm --version)"
elif command -v npm &>/dev/null; then
  NODE_CMD="npm"
  ok "npm found: $(npm --version)"
else
  NODE_CMD=""
  warn "No Node package manager found — dashboard won't start"
  NO_DASHBOARD=true
fi

# Python deps
info "Syncing Python deps (apps/core)..."
(cd "$REPO_ROOT/apps/core" && uv sync --quiet 2>/dev/null) \
  && ok "Python deps synced" \
  || warn "uv sync had warnings — continuing"

# Node deps
if [[ "$NO_DASHBOARD" == false && -n "$NODE_CMD" ]]; then
  info "Checking Node deps (apps/dashboard)..."
  if [[ -d "$REPO_ROOT/apps/dashboard/node_modules" ]]; then
    ok "node_modules present"
  else
    info "Installing Node deps (first run — this may take a minute)..."
    (cd "$REPO_ROOT/apps/dashboard" && $NODE_CMD install --silent 2>/dev/null) \
      && ok "Node deps installed" || warn "Node install had warnings — continuing"
  fi
fi

echo ""

# ── 3. Ollama check ────────────────────────────────────────────────────────
info "Checking Ollama..."
if curl -sf http://localhost:11434/api/tags &>/dev/null; then
  MODELS=$(curl -s http://localhost:11434/api/tags \
    | python3 -c "import sys,json; ms=json.load(sys.stdin).get('models',[]); print(', '.join(m['name'] for m in ms) or 'none loaded')" 2>/dev/null || echo "?")
  ok "Ollama running — models: $MODELS"
  OLLAMA_UP=true
else
  warn "Ollama not detected — local inference unavailable"
  warn "  Start: ollama serve"
  warn "  Pull:  ollama pull llama3.1:8b && ollama pull qwen3-coder:30b"
  OLLAMA_UP=false
fi

# ── 4. OpenClaw / Claude Max proxy check ──────────────────────────────────
info "Checking OpenClaw (port 18789)..."
if port_in_use 18789; then
  ok "OpenClaw proxy running on :18789"
else
  warn "OpenClaw not detected — using ollama or anthropic backend"
fi

echo ""

# ── 5. Python API server (FastAPI, port 8000) ─────────────────────────────
if [[ "$NO_API" == false ]]; then
  info "Starting Python API server (port 8000)..."
  if port_in_use 8000; then
    ok "Port 8000 already in use — skipping"
  else
    (
      cd "$REPO_ROOT/apps/core"
      uv run uvicorn api.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --log-level warning \
        >> "$LOGS_DIR/api.log" 2>&1
    ) &
    API_PID=$!
    if wait_for_port 8000 "Python API"; then
      ok "Python API started (PID $API_PID) → logs: $LOGS_DIR/api.log"
    fi
  fi
fi

# ── 6. Dashboard (Next.js, port 3000) ─────────────────────────────────────
if [[ "$NO_DASHBOARD" == false ]]; then
  info "Starting dashboard (port 3000)..."
  if port_in_use 3000; then
    ok "Port 3000 already in use — skipping"
  else
    (
      cd "$REPO_ROOT/apps/dashboard"
      ${NODE_CMD:-npm} run dev >> "$LOGS_DIR/dashboard.log" 2>&1
    ) &
    DASH_PID=$!
    ok "Dashboard starting (PID $DASH_PID) — may take ~10s → logs: $LOGS_DIR/dashboard.log"
  fi
fi

# ── 7. Heartbeat agent ────────────────────────────────────────────────────
if [[ "$NO_AGENTS" == false ]]; then
  info "Starting heartbeat agent..."
  if proc_running "agents.heartbeat"; then
    ok "Heartbeat agent already running"
  else
    (cd "$REPO_ROOT/apps/core" && uv run python -m agents.heartbeat \
      >> "$LOGS_DIR/heartbeat.log" 2>&1) &
    ok "Heartbeat agent started → $LOGS_DIR/heartbeat.log"
  fi

  info "Starting MCP server..."
  if proc_running "agent_mcp.server"; then
    ok "MCP server already running"
  else
    (cd "$REPO_ROOT/apps/core" && uv run python -m agent_mcp.server \
      >> "$LOGS_DIR/mcp_server.log" 2>&1) &
    ok "MCP server started → $LOGS_DIR/mcp_server.log"
  fi
fi

# ── 8. Discord bot (optional) ─────────────────────────────────────────────
if [[ "$START_DISCORD" == true ]]; then
  info "Starting Discord bot..."
  if proc_running "start_discord_bot"; then
    ok "Discord bot already running"
  else
    (cd "$REPO_ROOT/apps/core" && uv run python start_discord_bot.py \
      >> "$LOGS_DIR/discord_bot.log" 2>&1) &
    ok "Discord bot started → $LOGS_DIR/discord_bot.log"
  fi
fi

echo ""

# ── 9. Health check ───────────────────────────────────────────────────────
if [[ "$NO_API" == false ]]; then
  info "API health check..."
  HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
svc=d.get('services',{})
ollama=svc.get('ollama',{})
print(f\"status={d.get('status','?')} backend={d.get('backend','?')} ollama={'UP' if ollama.get('reachable') else 'DOWN'}\")
" 2>/dev/null \
    || echo "not yet ready")
  ok "GET /health → $HEALTH"
fi

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Running Services${RESET}"
echo ""
[[ "$NO_API" == false ]]       && echo "  Python API  → http://localhost:8000"
[[ "$NO_API" == false ]]       && echo "  Health      → http://localhost:8000/health"
[[ "$NO_API" == false ]]       && echo "  Agents      → http://localhost:8000/agents"
[[ "$NO_API" == false ]]       && echo "  Tasks       → http://localhost:8000/tasks"
[[ "$NO_DASHBOARD" == false ]] && echo "  Dashboard   → http://localhost:3000"
[[ "$NO_DASHBOARD" == false ]] && echo "  Mission Ctl → http://localhost:3000/mission-control"
echo ""
echo "  Logs: $LOGS_DIR/"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
