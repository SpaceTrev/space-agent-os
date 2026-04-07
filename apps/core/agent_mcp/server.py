"""Space-Agent-OS FastMCP Server

Closes the verification loop: agents write code, then call these tools to
confirm it actually works — without a human running terminal commands.

Start:
    uv run python -m mcp.server          # from apps/core/
    uv run python apps/core/mcp/server.py  # from monorepo root

Tools
-----
Health & Verification:  health_check, ping_ollama, run_tests
Task Queue (TASKS.md):  list_tasks, add_task, update_task_status
Agent Control:          start_engine, stop_engine, engine_status
Dashboard:              build_dashboard, call_api
Logs:                   read_logs
"""
from __future__ import annotations

import json
import logging
import os
import re
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import structlog
from dotenv import load_dotenv
from fastmcp import FastMCP

# ── Bootstrap ─────────────────────────────────────────────────────────────────

load_dotenv()

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ── Paths ─────────────────────────────────────────────────────────────────────

CORE_ROOT = Path(__file__).parent.parent        # apps/core/
REPO_ROOT = CORE_ROOT.parent.parent             # monorepo root
TASKS_FILE = CORE_ROOT / "TASKS.md"
TASKS_DONE_FILE = CORE_ROOT / "TASKS_DONE.md"
AUDIT_LOG = CORE_ROOT / "logs" / "audit.jsonl"
PIDS_FILE = CORE_ROOT / "logs" / "pids.json"
AGENTS_DIR = CORE_ROOT / "agents"
DASHBOARD_DIR = REPO_ROOT / "apps" / "dashboard"

# ── Config ────────────────────────────────────────────────────────────────────

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DASHBOARD_URL: str = os.getenv("DASHBOARD_URL", "http://localhost:3000")
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MAX_PROXY_URL: str = os.getenv("CLAUDE_MAX_PROXY_URL", "http://localhost:3456/v1")
PRIMARY_BACKEND: str = os.getenv("PRIMARY_BACKEND", "ollama")

# ── Server ────────────────────────────────────────────────────────────────────

mcp = FastMCP("space-agent-os")

# ── Internal helpers ──────────────────────────────────────────────────────────

PRIORITY_RE = re.compile(
    r"^\s*-\s+\[(?P<priority>URGENT|HIGH|NORMAL|LOW)\]\s+(?P<description>.+)$"
)
SECTION_RE = re.compile(r"^##\s+(?P<name>URGENT|HIGH|NORMAL|LOW)\s*$")


def _run(cmd: list[str], cwd: Path | None = None, timeout: int = 120) -> dict[str, Any]:
    """Run a subprocess, capture stdout+stderr, return structured result."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "ok": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "returncode": -1,
            "stdout": "",
            "stderr": f"Timed out after {timeout}s",
        }
    except Exception as exc:
        return {"ok": False, "returncode": -1, "stdout": "", "stderr": str(exc)}


def _load_pids() -> dict[str, int]:
    """Read PID registry from logs/pids.json."""
    if PIDS_FILE.exists():
        try:
            return json.loads(PIDS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_pids(pids: dict[str, int]) -> None:
    """Persist PID registry to logs/pids.json."""
    PIDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PIDS_FILE.write_text(json.dumps(pids, indent=2), encoding="utf-8")


def _is_running(pid: int) -> bool:
    """Return True if a process with *pid* is alive (POSIX signal 0 probe)."""
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _parse_tasks_md(content: str) -> dict[str, list[dict[str, str]]]:
    """Parse TASKS.md into a dict keyed by priority section."""
    sections: dict[str, list[dict[str, str]]] = {
        "URGENT": [],
        "HIGH": [],
        "NORMAL": [],
        "LOW": [],
    }
    current_section: str | None = None
    for line in content.splitlines():
        sm = SECTION_RE.match(line)
        if sm:
            current_section = sm.group("name")
            continue
        tm = PRIORITY_RE.match(line)
        if tm and current_section:
            sections[current_section].append({
                "priority": tm.group("priority"),
                "description": tm.group("description").strip(),
            })
    return sections


# ── Tools: Health & Verification ──────────────────────────────────────────────


@mcp.tool()
async def health_check() -> dict[str, Any]:
    """Run health checks for all system nodes and return Pass/Fail per node.

    Checks: Ollama reachability, Anthropic API key validity, dashboard build
    artifact presence, Supabase DB configuration, and TASKS.md readability.
    """
    nodes: dict[str, Any] = {}

    # 1 — Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            nodes["ollama"] = {
                "ok": True,
                "status": "running",
                "url": OLLAMA_BASE_URL,
                "models": models,
                "model_count": len(models),
            }
    except Exception as exc:
        nodes["ollama"] = {
            "ok": False,
            "status": "unreachable",
            "url": OLLAMA_BASE_URL,
            "error": str(exc),
        }

    # 2 — Claude (Max proxy or direct API key)
    if PRIMARY_BACKEND == "claude_max":
        try:
            proxy_health = CLAUDE_MAX_PROXY_URL.replace("/v1", "") + "/health"
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(proxy_health)
                nodes["anthropic"] = {
                    "ok": resp.status_code == 200,
                    "status": "claude_max_proxy_ok" if resp.status_code == 200 else "proxy_error",
                    "backend": "claude-max-api-proxy",
                    "url": proxy_health,
                }
        except Exception as exc:
            nodes["anthropic"] = {
                "ok": False,
                "status": "proxy_unreachable",
                "error": str(exc),
                "hint": "Run: claude-max-api",
            }
    elif ANTHROPIC_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
                )
                nodes["anthropic"] = {
                    "ok": resp.status_code == 200,
                    "status": "api_key_ok" if resp.status_code == 200 else f"http_{resp.status_code}",
                }
        except Exception as exc:
            nodes["anthropic"] = {"ok": False, "status": "error", "error": str(exc)}
    else:
        nodes["anthropic"] = {
            "ok": False,
            "status": "not_configured",
            "hint": "Set PRIMARY_BACKEND=claude_max and run claude-max-api, or set ANTHROPIC_API_KEY",
        }

    # 3 — Dashboard build artifact (.next/BUILD_ID)
    build_id_file = DASHBOARD_DIR / ".next" / "BUILD_ID"
    next_dir = DASHBOARD_DIR / ".next"
    if build_id_file.exists():
        nodes["dashboard_build"] = {
            "ok": True,
            "status": "built",
            "build_id": build_id_file.read_text(encoding="utf-8").strip(),
        }
    elif next_dir.exists():
        nodes["dashboard_build"] = {
            "ok": True,
            "status": "partial_build",
            "hint": "Build exists but BUILD_ID missing — try build_dashboard()",
        }
    else:
        nodes["dashboard_build"] = {
            "ok": False,
            "status": "not_built",
            "hint": "Run build_dashboard() to produce an artifact",
        }

    # 4 — Supabase DB (env-var presence check; no live network call needed)
    # DB config lives in apps/dashboard/.env.local — load it if present
    dashboard_env = DASHBOARD_DIR / ".env.local"
    if dashboard_env.exists():
        from dotenv import dotenv_values
        dash_env = dotenv_values(dashboard_env)
    else:
        dash_env = {}
    db_url = (
        os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        or os.getenv("SUPABASE_URL")
        or dash_env.get("NEXT_PUBLIC_SUPABASE_URL")
        or dash_env.get("SUPABASE_URL", "")
    )
    db_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or dash_env.get("SUPABASE_SERVICE_KEY")
        or dash_env.get("SUPABASE_ANON_KEY", "")
    )
    # Also do a live ping if URL is set
    db_live = False
    if db_url:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{db_url}/rest/v1/", headers={
                    "apikey": db_key,
                    "Authorization": f"Bearer {db_key}",
                })
                db_live = r.status_code == 200
        except Exception:
            pass
    nodes["database"] = {
        "ok": bool(db_url and db_key and db_live),
        "status": "live" if db_live else ("configured" if (db_url and db_key) else "not_configured"),
        "url": db_url or "—",
        "live": db_live,
    }

    # 5 — TASKS.md readable
    nodes["tasks_file"] = {
        "ok": TASKS_FILE.exists(),
        "status": "present" if TASKS_FILE.exists() else "missing",
        "path": str(TASKS_FILE),
    }

    overall_ok = all(v["ok"] for v in nodes.values())
    passed = sum(1 for v in nodes.values() if v["ok"])
    return {
        "ok": overall_ok,
        "passed": passed,
        "total": len(nodes),
        "nodes": nodes,
    }


@mcp.tool()
async def ping_ollama() -> dict[str, Any]:
    """Hit Ollama /api/tags and return a list of currently loaded models."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = [
                {
                    "name": m["name"],
                    "size_gb": round(m.get("size", 0) / 1e9, 2),
                    "modified_at": m.get("modified_at", ""),
                }
                for m in resp.json().get("models", [])
            ]
            return {
                "ok": True,
                "url": OLLAMA_BASE_URL,
                "count": len(models),
                "models": models,
            }
    except httpx.ConnectError:
        return {
            "ok": False,
            "url": OLLAMA_BASE_URL,
            "error": "Connection refused — is Ollama running?",
        }
    except Exception as exc:
        return {"ok": False, "url": OLLAMA_BASE_URL, "error": str(exc)}


@mcp.tool()
def run_tests(
    test_path: str = "tests/",
    extra_args: list[str] | None = None,
) -> dict[str, Any]:
    """Run pytest on apps/core/tests/ (or a given path) and return pass/fail counts.

    Args:
        test_path: Path relative to apps/core/. Defaults to 'tests/'.
        extra_args: Optional extra pytest flags, e.g. ['-x', '-v', '-k', 'smoke'].
    """
    abs_test_path = CORE_ROOT / test_path
    if not abs_test_path.exists():
        return {
            "ok": False,
            "error": f"Test path not found: {abs_test_path}",
            "hint": "Create apps/core/tests/ with pytest files to get started",
            "passed": 0,
            "failed": 0,
            "errors": 0,
            "stdout": "",
            "stderr": "",
        }

    cmd = [sys.executable, "-m", "pytest", str(abs_test_path), "--tb=short", "-q"]
    if extra_args:
        cmd.extend(extra_args)

    raw = _run(cmd, cwd=CORE_ROOT, timeout=120)

    # Extract counts from pytest summary line
    passed = failed = errors = 0
    for line in (raw["stdout"] + "\n" + raw["stderr"]).splitlines():
        m = re.search(r"(\d+) passed", line)
        if m:
            passed = int(m.group(1))
        m = re.search(r"(\d+) failed", line)
        if m:
            failed = int(m.group(1))
        m = re.search(r"(\d+) error", line)
        if m:
            errors = int(m.group(1))

    return {
        "ok": raw["ok"],
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "stdout": raw["stdout"],
        "stderr": raw["stderr"],
    }


# ── Tools: Task Queue (TASKS.md) ──────────────────────────────────────────────


@mcp.tool()
def list_tasks() -> dict[str, Any]:
    """Read TASKS.md and return all tasks grouped by priority section."""
    if not TASKS_FILE.exists():
        return {"ok": False, "error": "TASKS.md not found", "tasks": {}}

    content = TASKS_FILE.read_text(encoding="utf-8")
    sections = _parse_tasks_md(content)

    last_heartbeat = "never"
    for line in content.splitlines():
        if "*Last heartbeat:" in line:
            last_heartbeat = line.strip().strip("*").replace("Last heartbeat:", "").strip()
            break

    total = sum(len(v) for v in sections.values())
    return {
        "ok": True,
        "total": total,
        "last_heartbeat": last_heartbeat,
        "tasks": sections,
    }


@mcp.tool()
def add_task(
    title: str,
    priority: str = "NORMAL",
    description: str = "",
    verify_command: str = "",
    owner: str = "",
    tag: str = "",
) -> dict[str, Any]:
    """Append a new task to the correct priority section in TASKS.md.

    Args:
        title: Short task title (required).
        priority: URGENT | HIGH | NORMAL | LOW. Defaults to NORMAL.
        description: Optional longer description, appended as an indented note.
        verify_command: Optional shell command to verify the task was completed.
        owner: Optional @owner tag (@ prefix optional).
        tag: Optional #tag (# prefix optional).
    """
    priority = priority.upper()
    if priority not in ("URGENT", "HIGH", "NORMAL", "LOW"):
        return {
            "ok": False,
            "error": f"Invalid priority '{priority}'. Must be URGENT | HIGH | NORMAL | LOW",
        }

    if not TASKS_FILE.exists():
        return {"ok": False, "error": "TASKS.md not found"}

    content = TASKS_FILE.read_text(encoding="utf-8")

    # Build the task line
    parts: list[str] = [f"- [{priority}] {title}"]
    if owner:
        parts.append(f"@{owner.lstrip('@')}")
    if tag:
        parts.append(f"#{tag.lstrip('#')}")
    if verify_command:
        parts.append(f"— verify: `{verify_command}`")
    task_line = " ".join(parts)
    if description:
        task_line += f"\n  {description}"

    # Insert immediately before the next section header (or ---) after ## PRIORITY
    lines = content.splitlines()
    section_header = f"## {priority}"
    insert_idx: int | None = None
    for i, line in enumerate(lines):
        if line.strip() == section_header:
            for j in range(i + 1, len(lines)):
                if lines[j].startswith("##") or lines[j].startswith("---"):
                    insert_idx = j
                    break
            else:
                insert_idx = len(lines)
            break

    if insert_idx is None:
        new_content = content.rstrip() + f"\n\n{task_line}\n"
    else:
        lines.insert(insert_idx, task_line)
        new_content = "\n".join(lines) + "\n"

    TASKS_FILE.write_text(new_content, encoding="utf-8")
    log.info("mcp.task_added", title=title, priority=priority)
    return {"ok": True, "task": task_line.splitlines()[0], "priority": priority}


@mcp.tool()
def update_task_status(
    title_fragment: str,
    new_status: str,
    result_message: str = "",
) -> dict[str, Any]:
    """Move a task to a new status within TASKS.md or archive it to TASKS_DONE.md.

    Matching is a case-insensitive substring search on the task description.
    Returns an error if the fragment matches zero or more than one task.

    Args:
        title_fragment: Substring to match against task descriptions.
        new_status: done | urgent | high | normal | low | remove
            - done   → archives to TASKS_DONE.md with UTC timestamp
            - urgent/high/normal/low → moves to that priority section
            - remove → deletes from TASKS.md without archiving
        result_message: Optional note to attach when marking done.
    """
    new_status = new_status.lower()
    valid = {"done", "urgent", "high", "normal", "low", "remove"}
    if new_status not in valid:
        return {
            "ok": False,
            "error": f"Invalid status '{new_status}'. Valid: {', '.join(sorted(valid))}",
        }

    if not TASKS_FILE.exists():
        return {"ok": False, "error": "TASKS.md not found"}

    content = TASKS_FILE.read_text(encoding="utf-8")
    lines = content.splitlines()

    # Find matching lines
    matches: list[tuple[int, str]] = [
        (i, line.strip())
        for i, line in enumerate(lines)
        if PRIORITY_RE.match(line)
        and title_fragment.lower() in PRIORITY_RE.match(line).group("description").lower()  # type: ignore[union-attr]
    ]

    if not matches:
        return {
            "ok": False,
            "error": f"No task matching '{title_fragment}' in TASKS.md",
        }
    if len(matches) > 1:
        return {
            "ok": False,
            "error": f"Ambiguous: {len(matches)} tasks match '{title_fragment}'",
            "matches": [line for _, line in matches],
        }

    idx, original_line = matches[0]

    # Remove the matched line (and optional indented description line below it)
    del lines[idx]
    if idx < len(lines) and lines[idx].startswith("  "):
        del lines[idx]

    updated_content = "\n".join(lines) + "\n"

    if new_status == "remove":
        TASKS_FILE.write_text(updated_content, encoding="utf-8")
        return {"ok": True, "action": "removed", "task": original_line}

    if new_status == "done":
        TASKS_FILE.write_text(updated_content, encoding="utf-8")
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        done_line = f"- [DONE] {ts} {original_line}"
        if result_message:
            done_line += f"\n  Result: {result_message}"
        prior = (
            TASKS_DONE_FILE.read_text(encoding="utf-8")
            if TASKS_DONE_FILE.exists()
            else ""
        )
        TASKS_DONE_FILE.write_text(prior.rstrip() + f"\n{done_line}\n", encoding="utf-8")
        log.info("mcp.task_done", task=original_line[:60])
        return {"ok": True, "action": "done", "task": original_line, "timestamp": ts}

    # Re-priority: insert updated task line into the new section
    new_priority = new_status.upper()
    new_task_line = re.sub(
        r"^\s*-\s+\[(?:URGENT|HIGH|NORMAL|LOW)\]",
        f"- [{new_priority}]",
        original_line,
    )
    updated_lines = updated_content.splitlines()
    section_header = f"## {new_priority}"
    insert_idx: int | None = None
    for i, line in enumerate(updated_lines):
        if line.strip() == section_header:
            for j in range(i + 1, len(updated_lines)):
                if updated_lines[j].startswith("##") or updated_lines[j].startswith("---"):
                    insert_idx = j
                    break
            else:
                insert_idx = len(updated_lines)
            break

    if insert_idx is None:
        final = updated_content.rstrip() + f"\n{new_task_line}\n"
    else:
        updated_lines.insert(insert_idx, new_task_line)
        final = "\n".join(updated_lines) + "\n"

    TASKS_FILE.write_text(final, encoding="utf-8")
    log.info("mcp.task_moved", task=original_line[:60], to=new_priority)
    return {"ok": True, "action": "moved", "task": new_task_line, "new_priority": new_priority}


# ── Tools: Agent Control ──────────────────────────────────────────────────────


@mcp.tool()
def start_engine(components: list[str] | None = None) -> dict[str, Any]:
    """Spawn heartbeat.py and/or worker.py as detached background processes.

    Args:
        components: Which agents to start: ['heartbeat', 'worker'].
                    Defaults to both.
    Returns PIDs for all started (or already-running) processes.
    """
    if components is None:
        components = ["heartbeat", "worker"]

    pids = _load_pids()
    results: dict[str, Any] = {}

    for name in components:
        script = AGENTS_DIR / f"{name}.py"
        if not script.exists():
            results[name] = {
                "ok": False,
                "error": f"Script not found: {script}",
            }
            continue

        existing_pid = pids.get(name)
        if existing_pid and _is_running(existing_pid):
            results[name] = {
                "ok": True,
                "status": "already_running",
                "pid": existing_pid,
            }
            continue

        try:
            proc = subprocess.Popen(
                [sys.executable, str(script)],
                cwd=CORE_ROOT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            pids[name] = proc.pid
            results[name] = {"ok": True, "status": "started", "pid": proc.pid}
            log.info("mcp.engine_started", name=name, pid=proc.pid)
        except Exception as exc:
            results[name] = {"ok": False, "error": str(exc)}

    _save_pids(pids)
    return {
        "ok": all(v["ok"] for v in results.values()),
        "components": results,
    }


@mcp.tool()
def stop_engine(components: list[str] | None = None) -> dict[str, Any]:
    """Send SIGTERM to tracked heartbeat and/or worker processes.

    Args:
        components: Which agents to stop: ['heartbeat', 'worker'].
                    Defaults to both.
    """
    if components is None:
        components = ["heartbeat", "worker"]

    pids = _load_pids()
    results: dict[str, Any] = {}

    for name in components:
        pid = pids.get(name)
        if not pid:
            results[name] = {"ok": True, "status": "not_tracked"}
            continue
        if not _is_running(pid):
            results[name] = {"ok": True, "status": "already_stopped", "pid": pid}
            pids.pop(name, None)
            continue
        try:
            os.kill(pid, signal.SIGTERM)
            pids.pop(name, None)
            results[name] = {"ok": True, "status": "terminated", "pid": pid}
            log.info("mcp.engine_stopped", name=name, pid=pid)
        except Exception as exc:
            results[name] = {"ok": False, "pid": pid, "error": str(exc)}

    _save_pids(pids)
    return {
        "ok": all(v["ok"] for v in results.values()),
        "components": results,
    }


@mcp.tool()
def engine_status() -> dict[str, Any]:
    """Return running state (PID + alive flag) for heartbeat and worker."""
    pids = _load_pids()
    processes: dict[str, Any] = {}

    for name in ("heartbeat", "worker"):
        pid = pids.get(name)
        running = bool(pid and _is_running(pid))
        processes[name] = {"running": running, "pid": pid}

    all_running = all(v["running"] for v in processes.values())
    return {"ok": True, "all_running": all_running, "processes": processes}


# ── Tools: Dashboard ──────────────────────────────────────────────────────────


@mcp.tool()
def build_dashboard() -> dict[str, Any]:
    """Run `pnpm build` in apps/dashboard and return success/error output.

    Output is truncated to 3000 chars (stdout) / 2000 chars (stderr) to
    keep the tool response readable.
    """
    if not DASHBOARD_DIR.exists():
        return {
            "ok": False,
            "error": f"Dashboard directory not found: {DASHBOARD_DIR}",
        }

    result = _run(["pnpm", "build"], cwd=DASHBOARD_DIR, timeout=300)
    stdout = result["stdout"]
    stderr = result["stderr"]
    return {
        "ok": result["ok"],
        "returncode": result["returncode"],
        "stdout": stdout[-3000:] if len(stdout) > 3000 else stdout,
        "stderr": stderr[-2000:] if len(stderr) > 2000 else stderr,
        "hint": None if result["ok"] else "Check stderr for build errors",
    }


@mcp.tool()
async def call_api(
    path: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Make an HTTP request to a dashboard API endpoint and return the response.

    Useful for verifying that API routes work correctly after code changes.
    Examples: /api/sessions, /api/billing/usage, /api/tasks, /api/models/health

    Args:
        path: API path starting with '/'. E.g. '/api/sessions'.
        method: HTTP method: GET | POST | PUT | DELETE. Defaults to GET.
        body: Optional JSON payload for POST/PUT.
        headers: Optional extra headers to merge into the request.
    """
    url = f"{DASHBOARD_URL}{path}"
    method = method.upper()
    req_headers: dict[str, str] = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(method, url, json=body, headers=req_headers)
            try:
                response_body: Any = resp.json()
            except Exception:
                response_body = resp.text
            return {
                "ok": 200 <= resp.status_code < 300,
                "status_code": resp.status_code,
                "url": url,
                "method": method,
                "body": response_body,
            }
    except httpx.ConnectError:
        return {
            "ok": False,
            "url": url,
            "error": f"Connection refused — is the dashboard running at {DASHBOARD_URL}?",
            "hint": "Start with: pnpm --filter @space-agent-os/dashboard dev",
        }
    except Exception as exc:
        return {"ok": False, "url": url, "error": str(exc)}


# ── Tools: Logs ───────────────────────────────────────────────────────────────


@mcp.tool()
def read_logs(
    lines: int = 50,
    log_file: str = "logs/audit.jsonl",
) -> dict[str, Any]:
    """Tail the last N lines from an agent log file and parse JSONL entries.

    Args:
        lines: Number of lines to return from the end of the file. Defaults to 50.
        log_file: Path relative to apps/core/. Defaults to 'logs/audit.jsonl'.
    """
    abs_path = CORE_ROOT / log_file
    if not abs_path.exists():
        return {
            "ok": False,
            "path": str(abs_path),
            "error": "Log file not found — agents may not have run yet",
            "entries": [],
            "total_lines": 0,
            "returned": 0,
        }

    all_lines = abs_path.read_text(encoding="utf-8").splitlines()
    tail = all_lines[-lines:] if len(all_lines) > lines else all_lines

    entries: list[Any] = []
    for line in tail:
        if not line.strip():
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            entries.append(line)

    return {
        "ok": True,
        "path": str(abs_path),
        "total_lines": len(all_lines),
        "returned": len(entries),
        "entries": entries,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("mcp.server_start", name="space-agent-os", core_root=str(CORE_ROOT))
    mcp.run()
