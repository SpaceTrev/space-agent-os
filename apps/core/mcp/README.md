# Space-Agent-OS MCP Server

A FastMCP server that gives AI agents (and Claude via Cowork) direct access to the running system. Agents write code, then use these tools to verify it actually works — closing the loop without human terminal intervention.

## Tools

### Health & Verification
| Tool | Description |
|------|-------------|
| `health_check` | Checks Ollama, Anthropic API, dashboard build artifact, Supabase config, and TASKS.md. Returns structured Pass/Fail per node. |
| `ping_ollama` | Hits `/api/tags` on the local Ollama instance. Returns list of loaded models with sizes. |
| `run_tests` | Runs pytest on `apps/core/tests/` (or a custom path). Returns pass/fail/error counts and output. |

### Task Queue
| Tool | Description |
|------|-------------|
| `list_tasks` | Reads TASKS.md and returns tasks grouped by priority (URGENT / HIGH / NORMAL / LOW). |
| `add_task` | Appends a new task to the correct priority section. Supports `verify_command`, `owner`, and `tag`. |
| `update_task_status` | Moves a task to a new priority, marks it done (archived to TASKS_DONE.md), or removes it. |

### Agent Control
| Tool | Description |
|------|-------------|
| `start_engine` | Spawns `heartbeat.py` and/or `worker.py` as detached background processes. Returns PIDs. |
| `stop_engine` | Sends SIGTERM to tracked heartbeat/worker processes. |
| `engine_status` | Returns running state and PID for heartbeat and worker. |

### Dashboard
| Tool | Description |
|------|-------------|
| `build_dashboard` | Runs `pnpm build` in `apps/dashboard`. Returns exit code, stdout, stderr. |
| `call_api` | Makes a GET/POST/PUT/DELETE request to a dashboard API endpoint. Returns status code and parsed response body. |

### Logs
| Tool | Description |
|------|-------------|
| `read_logs` | Tails the last N lines of `logs/audit.jsonl` (or any log file). Parses JSONL entries. |

---

## Setup

### 1. Install dependencies

```bash
cd apps/core
uv sync
```

This installs `fastmcp`, `python-dotenv`, `httpx`, and `structlog`.

### 2. Configure environment

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, OLLAMA_BASE_URL, Supabase vars, etc.
```

### 3. Run the server

```bash
# From apps/core/
uv run python -m mcp.server

# Or directly:
uv run python apps/core/mcp/server.py
```

The server communicates over **stdio** (the MCP standard transport). It does not bind a port.

---

## Connecting to Claude Code (Cowork)

Add the server to your Claude Code MCP config. The easiest place is `apps/dashboard/.mcp.json` (already tracked in the repo) or your global `~/.claude/mcp.json`.

```json
{
  "mcpServers": {
    "space-agent-os": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/apps/core", "python", "-m", "mcp.server"],
      "env": {
        "OLLAMA_BASE_URL": "http://localhost:11434",
        "DASHBOARD_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `/absolute/path/to/apps/core` with the real path on your machine (e.g. `~/Space/active-projects/space-agent-os/apps/core`).

After saving, restart Claude Code. The tools will appear under the `space-agent-os` server in the tool list.

### Quick-connect one-liner (Claude Code CLI)

```bash
claude mcp add space-agent-os \
  --command uv \
  --args "run --directory $(pwd)/apps/core python -m mcp.server"
```

---

## Example agent workflow

```python
# 1. Verify the system is healthy before starting work
health = await mcp.call_tool("health_check")
assert health["nodes"]["ollama"]["ok"], "Ollama is down"

# 2. Check what tasks are pending
tasks = await mcp.call_tool("list_tasks")
urgent = tasks["tasks"]["URGENT"]

# 3. After writing code, run tests to confirm it works
results = await mcp.call_tool("run_tests", {"test_path": "tests/test_heartbeat.py"})
assert results["failed"] == 0

# 4. Hit the dashboard API to confirm the endpoint responds
resp = await mcp.call_tool("call_api", {"path": "/api/models/health"})
assert resp["ok"]

# 5. Mark the task done
await mcp.call_tool("update_task_status", {
    "title_fragment": "smoke tests",
    "new_status": "done",
    "result_message": "All 12 tests pass",
})
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `DASHBOARD_URL` | `http://localhost:3000` | Next.js dashboard URL (for `call_api`) |
| `ANTHROPIC_API_KEY` | — | Required for `health_check` Anthropic node |
| `LOG_LEVEL` | `INFO` | structlog level |

All variables are loaded from `apps/core/.env` automatically on server startup.

---

## PID tracking

`start_engine` / `stop_engine` / `engine_status` persist process IDs to `apps/core/logs/pids.json`. If you kill agents outside the MCP (e.g. `kill <pid>`), the file may be stale — `engine_status` will detect this via a POSIX signal-0 probe and report them as stopped.
