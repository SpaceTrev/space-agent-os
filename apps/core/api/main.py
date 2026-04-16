"""
Space-Claw HTTP API — FastAPI server

Endpoints:
  GET  /health            — liveness + dependency status
  GET  /status            — LLM backend status
  GET  /agents            — list all registered agents
  GET  /tasks             — read TASKS.md (queued/active tasks)
  POST /dispatch          — send a goal to CentralBrain, return result
  GET  /models            — list Ollama models

Start:
  uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging
import os
import re
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
import structlog
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Bootstrap ─────────────────────────────────────────────────────────────────

CORE_ROOT = Path(__file__).parent.parent
load_dotenv(CORE_ROOT / ".env")

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

TASKS_FILE = CORE_ROOT / "TASKS.md"
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# ── Timescale (TODO) ──────────────────────────────────────────────────────────
# TIMESCALE_URL / DATABASE_URL can be set to a Timescale Cloud connection string.
# Once set, the API will persist agent runs, task history, and metrics to
# Timescale's hypertables instead of ephemeral in-memory state.
# Wiring not implemented yet — tracked in TASKS.md as [HIGH] Timescale integration.
_TIMESCALE_URL: str | None = os.getenv("TIMESCALE_URL") or os.getenv("DATABASE_URL")
if _TIMESCALE_URL:
    log.info("timescale.configured", url=_TIMESCALE_URL[:40] + "…")
else:
    log.info("timescale.not_configured", hint="Set TIMESCALE_URL or DATABASE_URL to enable persistence")

# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    log.info("api.startup", port=8000)
    yield
    log.info("api.shutdown")


app = FastAPI(
    title="Space-Claw API",
    version="1.0.0",
    description="Space-Agent-OS Python backend",
    lifespan=lifespan,
)

# ALLOWED_ORIGINS: comma-separated list of allowed origins.
# In Railway, set this to your Vercel domain, e.g.:
#   https://space-agent-os-dashboard.vercel.app,https://space-agent-os-dashboard-*.vercel.app
# Defaults to wildcard for local dev — credentials are disabled in wildcard mode.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_origins: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else ["http://localhost:3000", "http://localhost:3001"]
)
_wildcard = not _raw_origins  # allow * only when env var is unset (local dev)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _wildcard else _origins,
    allow_credentials=not _wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/Response models ───────────────────────────────────────────────────

class DispatchRequest(BaseModel):
    goal: str
    channel: str = "api"
    priority: str = "NORMAL"
    tags: list[str] = []
    history: list[dict[str, str]] = []


class DispatchResponse(BaseModel):
    request_id: str
    route: str
    output: str
    agents_used: list[str]
    elapsed_s: float
    error: str | None = None


class MemorySaveRequest(BaseModel):
    text: str
    title: str | None = None
    project: str = "fam-dispatch"


class MemorySearchRequest(BaseModel):
    query: str
    project: str = "fam-dispatch"
    limit: int = 5


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _ollama_reachable() -> tuple[bool, list[str]]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            return True, models
    except Exception:
        return False, []


def _parse_tasks_md() -> list[dict[str, Any]]:
    if not TASKS_FILE.exists():
        return []
    tasks: list[dict[str, Any]] = []
    priority_re = re.compile(r"^\s*-\s+\[(?P<priority>URGENT|HIGH|NORMAL|LOW)\]\s+(?P<desc>.+)$")
    for line in TASKS_FILE.read_text().splitlines():
        m = priority_re.match(line)
        if m:
            tasks.append({
                "id": str(uuid.uuid4())[:8],
                "priority": m.group("priority"),
                "description": m.group("desc").strip(),
                "status": "queued",
            })
    return tasks


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict[str, Any]:
    """Liveness + dependency check."""
    ollama_ok, models = await _ollama_reachable()
    primary_backend = os.getenv("PRIMARY_BACKEND", "ollama")
    claude_max_url = os.getenv("CLAUDE_MAX_PROXY_URL", "http://localhost:3456/v1")
    openclaw_ok = False
    if primary_backend == "claude_max":
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(claude_max_url.replace("/v1", "") + "/health")
                openclaw_ok = resp.status_code < 400
        except Exception:
            pass
    return {
        "status": "ok",
        "timestamp": time.time(),
        "services": {
            "ollama": {"reachable": ollama_ok, "url": OLLAMA_BASE_URL, "models": models},
            "openclaw": {"reachable": openclaw_ok, "url": claude_max_url, "enabled": primary_backend == "claude_max"},
            "anthropic": {"configured": bool(os.getenv("ANTHROPIC_API_KEY"))},
            "gemini": {"configured": bool(os.getenv("GEMINI_API_KEY"))},
        },
        "backend": primary_backend,
    }


@app.get("/status")
async def status() -> dict[str, Any]:
    """LLM backend status."""
    try:
        sys.path.insert(0, str(CORE_ROOT))
        from agents.role_spec import get_backend_status  # type: ignore[import]
        return get_backend_status()  # type: ignore[no-any-return]
    except Exception as exc:
        log.warning("status.import_error", error=str(exc))
        return {"error": str(exc), "primary_backend": os.getenv("PRIMARY_BACKEND", "ollama")}


@app.get("/agents")
async def list_agents() -> dict[str, Any]:
    """List all registered agent classes and their import status."""
    sys.path.insert(0, str(CORE_ROOT))
    registry = [
        {"name": "ContextAgent",          "role": "context",     "tier": "orchestrator", "module": "agents.context_agent"},
        {"name": "PMAgent",               "role": "pm",          "tier": "orchestrator", "module": "agents.pm_agent"},
        {"name": "PlannerAgent",          "role": "planner",     "tier": "orchestrator", "module": "agents.planner_agent"},
        {"name": "ResearcherAgent",       "role": "researcher",  "tier": "worker",       "module": "agents.researcher_agent"},
        {"name": "LeadArchitectAgent",    "role": "architect",   "tier": "architect",    "module": "agents.lead_architect"},
        {"name": "ReviewerAgent",         "role": "reviewer",    "tier": "architect",    "module": "agents.reviewer_agent"},
        {"name": "BackendEngineerAgent",  "role": "backend_eng", "tier": "worker",       "module": "agents.backend_engineer"},
        {"name": "FrontendEngineerAgent", "role": "frontend_eng","tier": "worker",       "module": "agents.frontend_engineer"},
        {"name": "DomainAgent",           "role": "domain",      "tier": "worker",       "module": "agents.domain_agent"},
    ]
    agents: list[dict[str, Any]] = []
    for entry in registry:
        try:
            __import__(entry["module"])
            entry["status"] = "ok"
        except Exception as exc:
            entry["status"] = f"import_error: {exc}"
        agents.append(entry)
    return {"agents": agents, "count": len(agents)}


@app.get("/tasks")
async def list_tasks() -> dict[str, Any]:
    """Parse and return TASKS.md as structured data."""
    tasks = _parse_tasks_md()
    return {"tasks": tasks, "count": len(tasks), "source": str(TASKS_FILE)}


@app.get("/models")
async def list_models() -> dict[str, Any]:
    """List Ollama models."""
    reachable, models = await _ollama_reachable()
    return {"ollama_reachable": reachable, "models": models, "ollama_url": OLLAMA_BASE_URL}


@app.post("/dispatch")
async def dispatch(req: DispatchRequest) -> DispatchResponse:
    """Dispatch a goal to CentralBrain and return the result."""
    sys.path.insert(0, str(CORE_ROOT))
    start = time.monotonic()
    try:
        from orchestration.central_brain import BrainRequest, CentralBrain  # type: ignore[import]
        brain = CentralBrain()
        brain_req = BrainRequest(
            goal=req.goal,
            channel=req.channel,
            priority=req.priority,
            tags=req.tags,
            history=req.history,
        )
        log.info("dispatch.start", goal=req.goal[:80], channel=req.channel)
        resp = await brain.handle(brain_req)
        elapsed = round(time.monotonic() - start, 3)
        return DispatchResponse(
            request_id=resp.request_id,
            route=resp.route.value if hasattr(resp.route, "value") else str(resp.route),
            output=resp.output,
            agents_used=resp.agent_roles_used,
            elapsed_s=elapsed,
            error=resp.error,
        )
    except Exception as exc:
        elapsed = round(time.monotonic() - start, 3)
        log.error("dispatch.error", error=str(exc))
        return DispatchResponse(
            request_id=str(uuid.uuid4())[:8],
            route="error",
            output="",
            agents_used=[],
            elapsed_s=elapsed,
            error=str(exc),
        )


# ── Memory (claude-mem) ───────────────────────────────────────────────────────

@app.post("/memory/save")
async def memory_save(req: MemorySaveRequest) -> dict[str, Any]:
    """Save an observation to the claude-mem worker (http://localhost:37777)."""
    sys.path.insert(0, str(CORE_ROOT))
    from memory.claude_mem import save_memory  # type: ignore[import]
    result = await save_memory(text=req.text, title=req.title, project=req.project)
    if result is None:
        return {"ok": False, "error": "claude-mem worker unreachable or returned error"}
    return {"ok": True, "result": result}


@app.get("/memory/search")
async def memory_search(
    query: str,
    project: str = "fam-dispatch",
    limit: int = 5,
) -> dict[str, Any]:
    """Search claude-mem observations. Query params: query, project, limit."""
    sys.path.insert(0, str(CORE_ROOT))
    from memory.claude_mem import search as claude_mem_search  # type: ignore[import]
    results = await claude_mem_search(query=query, project=project, limit=limit)
    return {"results": results, "count": len(results), "query": query, "project": project}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    # Railway injects $PORT; fall back to API_PORT then 8000 for local runs.
    port = int(os.getenv("PORT") or os.getenv("API_PORT") or "8000")
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("API_RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
