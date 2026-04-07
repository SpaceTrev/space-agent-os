"""
Space-Claw HTTP API — FastAPI server

Endpoints:
  GET  /health            — liveness + dependency status
  GET  /status            — LLM backend status
  GET  /agents            — list all registered agents
  GET  /tasks             — read TASKS.md (queued/active tasks)
  POST /dispatch          — send a goal to CentralBrain, stream result
  GET  /models            — list Ollama models

Start:
  uv run python -m api.main
  uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import asyncio
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
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
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


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _ollama_reachable() -> tuple[bool, list[str]]:
    """Return (reachable, model_names)."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            return True, models
    except Exception:
        return False, []


def _parse_tasks_md() -> list[dict[str, Any]]:
    """Parse TASKS.md into a list of task dicts."""
    if not TASKS_FILE.exists():
        return []

    tasks: list[dict[str, Any]] = []
    current_priority = "NORMAL"
    priority_re = re.compile(r"^\s*-\s+\[(?P<priority>URGENT|HIGH|NORMAL|LOW)\]\s+(?P<desc>.+)$")
    section_re = re.compile(r"^##\s+(URGENT|HIGH|NORMAL|LOW)\s*$")

    for line in TASKS_FILE.read_text().splitlines():
        m = section_re.match(line)
        if m:
            current_priority = m.group(1)
            continue
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
            "ollama": {
                "reachable": ollama_ok,
                "url": OLLAMA_BASE_URL,
                "models": models,
            },
            "openclaw": {
                "reachable": openclaw_ok,
                "url": claude_max_url,
                "enabled": primary_backend == "claude_max",
            },
            "anthropic": {
                "configured": bool(os.getenv("ANTHROPIC_API_KEY")),
            },
            "gemini": {
                "configured": bool(os.getenv("GEMINI_API_KEY")),
            },
        },
        "backend": primary_backend,
    }


@app.get("/status")
async def status() -> dict[str, Any]:
    """LLM backend status — same shape as CentralBrain.status()."""
    try:
        # Import lazily to avoid slow startup if deps missing
        sys.path.insert(0, str(CORE_ROOT))
        from agents.role_spec import get_backend_status
        return get_backend_status()
    except Exception as exc:
        log.warning("status.import_error", error=str(exc))
        return {"error": str(exc), "primary_backend": os.getenv("PRIMARY_BACKEND", "ollama")}


@app.get("/agents")
async def list_agents() -> dict[str, Any]:
    """List all registered agent classes."""
    sys.path.insert(0, str(CORE_ROOT))
    agents: list[dict[str, str]] = []

    # Static registry — matches what CentralBrain instantiates
    registry = [
        {"name": "ContextAgent",          "role": "context",    "tier": "orchestrator", "module": "agents.context_agent"},
        {"name": "PMAgent",               "role": "pm",         "tier": "orchestrator", "module": "agents.pm_agent"},
        {"name": "PlannerAgent",          "role": "planner",    "tier": "orchestrator", "module": "agents.planner_agent"},
        {"name": "ResearcherAgent",       "role": "researcher", "tier": "worker",       "module": "agents.researcher_agent"},
        {"name": "LeadArchitectAgent",    "role": "architect",  "tier": "architect",    "module": "agents.lead_architect"},
        {"name": "ReviewerAgent",         "role": "reviewer",   "tier": "architect",    "module": "agents.reviewer_agent"},
        {"name": "BackendEngineerAgent",  "role": "backend_eng","tier": "worker",       "module": "agents.backend_engineer"},
        {"name": "FrontendEngineerAgent", "role": "frontend_eng","tier": "worker",      "module": "agents.frontend_engineer"},
        {"name": "DomainAgent",           "role": "domain",     "tier": "worker",       "module": "agents.domain_agent"},
    ]

    # Try to verify each module is importable
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
    """Parse and return TASKS.md contents."""
    tasks = _parse_tasks_md()
    return {
        "tasks": tasks,
        "count": len(tasks),
        "source": str(TASKS_FILE),
    }


@app.get("/models")
async def list_models() -> dict[str, Any]:
    """List Ollama models."""
    reachable, models = await _ollama_reachable()
    return {
        "ollama_reachable": reachable,
        "models": models,
        "ollama_url": OLLAMA_BASE_URL,
    }


@app.post("/dispatch")
async def dispatch(req: DispatchRequest) -> DispatchResponse:
    """
    Dispatch a goal to CentralBrain and return the result.

    Routes: CHAT / PLAN / CODE / RESEARCH / REVIEW / ARCHITECT / SWARM
    """
    sys.path.insert(0, str(CORE_ROOT))
    start = time.monotonic()

    try:
        from orchestration.central_brain import BrainRequest, CentralBrain
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
        log.info("dispatch.done", elapsed_s=elapsed, route=resp.route)

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


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=int(os.getenv("API_PORT", "8000")),
        reload=os.getenv("API_RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
