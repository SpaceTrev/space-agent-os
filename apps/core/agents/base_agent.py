"""Space-Claw BaseAgent — shared foundation for all role agents.

All specialised agents inherit from BaseAgent and set:
  ROLE          human-readable role name (e.g. "Backend Engineer")
  TIER          one of: orchestrator | worker | architect
  SYSTEM_PROMPT persona + constraints for this role

The tier drives which model is used:
  orchestrator  → llama3.3:8b   (Ollama, fast triage/routing)
  worker        → qwen3-coder:30b-a3b (Ollama, code generation)
  architect     → claude-opus-4-6 via Anthropic API (deep reasoning)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

REPO_ROOT = Path(__file__).parent.parent
AUDIT_LOG = REPO_ROOT / "logs" / "audit.jsonl"

# ── Model config ──────────────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_NUM_PARALLEL: int = int(os.getenv("OLLAMA_NUM_PARALLEL", "4"))
ORCHESTRATOR_MODEL: str = os.getenv("ORCHESTRATOR_MODEL", "llama3.3:8b")
WORKER_MODEL: str = os.getenv("WORKER_MODEL", "qwen3-coder:30b-a3b")
ARCHITECT_MODEL: str = os.getenv("ARCHITECT_MODEL", "claude-opus-4-6")
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

TIER_MODELS: dict[str, str] = {
    "orchestrator": ORCHESTRATOR_MODEL,
    "worker": WORKER_MODEL,
    "architect": ARCHITECT_MODEL,
}

ANTHROPIC_BASE_URL = "https://api.anthropic.com"
ANTHROPIC_API_VERSION = "2023-06-01"

# ── Audit log ─────────────────────────────────────────────────────────────────

def append_audit(record: dict[str, Any]) -> None:
    """Append a JSONL record to logs/audit.jsonl."""
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_LOG.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")


# ── Ollama streaming ──────────────────────────────────────────────────────────

async def stream_ollama(
    prompt: str,
    *,
    model: str,
    system: str,
    client: httpx.AsyncClient,
) -> AsyncIterator[str]:
    """Stream tokens from Ollama /api/generate."""
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system,
        "stream": True,
        "options": {"num_parallel": OLLAMA_NUM_PARALLEL},
    }
    async with client.stream("POST", "/api/generate", json=payload, timeout=180.0) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            token = data.get("response", "")
            if token:
                yield token
            if data.get("done"):
                break


# ── Anthropic (architect tier) ────────────────────────────────────────────────

async def call_anthropic(
    prompt: str,
    *,
    system: str,
    model: str = ARCHITECT_MODEL,
    client: httpx.AsyncClient,
) -> str:
    """Non-streaming call to Anthropic Messages API."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set — architect tier unavailable")
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 8192,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }
    resp = await client.post(
        f"{ANTHROPIC_BASE_URL}/v1/messages",
        headers=headers,
        json=payload,
        timeout=300.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


# ── BaseAgent ─────────────────────────────────────────────────────────────────

class BaseAgent(ABC):
    """Abstract base for all Space-Claw role agents."""

    ROLE: str = "Base"
    TIER: str = "worker"  # orchestrator | worker | architect

    @property
    @abstractmethod
    def SYSTEM_PROMPT(self) -> str:  # noqa: N802
        """Return the persona system prompt for this role."""

    # ── Task execution ────────────────────────────────────────────────────────

    async def run_task(
        self,
        task: dict[str, Any],
        *,
        ollama_client: httpx.AsyncClient | None = None,
        anthropic_client: httpx.AsyncClient | None = None,
    ) -> str:
        """Execute a task dict and return the full response text."""
        task_id: str = task.get("id", "")
        description: str = task.get("description", "")
        priority: str = task.get("priority", "NORMAL")
        tags: list[str] = task.get("tags", [])

        log.info(
            "agent.task_start",
            role=self.ROLE,
            tier=self.TIER,
            task_id=task_id,
            description=description[:80],
        )

        started_at = time.monotonic()
        ts = datetime.now(timezone.utc).isoformat()
        error: str | None = None
        result = ""

        try:
            if self.TIER == "architect":
                client = anthropic_client or httpx.AsyncClient()
                result = await call_anthropic(
                    description,
                    system=self.SYSTEM_PROMPT,
                    client=client,
                )
            else:
                model = TIER_MODELS.get(self.TIER, WORKER_MODEL)
                client = ollama_client or httpx.AsyncClient(base_url=OLLAMA_BASE_URL)
                tokens: list[str] = []
                async for token in stream_ollama(
                    description,
                    model=model,
                    system=self.SYSTEM_PROMPT,
                    client=client,
                ):
                    tokens.append(token)
                result = "".join(tokens)
        except Exception as exc:
            error = str(exc)
            log.error("agent.task_error", role=self.ROLE, task_id=task_id, error=error)

        elapsed = round(time.monotonic() - started_at, 3)
        append_audit({
            "ts": ts,
            "role": self.ROLE,
            "tier": self.TIER,
            "task_id": task_id,
            "priority": priority,
            "tags": tags,
            "description": description,
            "model": TIER_MODELS.get(self.TIER, WORKER_MODEL),
            "elapsed_s": elapsed,
            "output_chars": len(result),
            "error": error,
        })
        log.info(
            "agent.task_done",
            role=self.ROLE,
            task_id=task_id,
            elapsed_s=elapsed,
            chars=len(result),
        )
        return result

    # ── Queue-based worker loop ───────────────────────────────────────────────

    async def run_queue(
        self,
        queue: asyncio.Queue[dict[str, Any]],
        *,
        concurrency: int = 2,
    ) -> None:
        """Drain a task queue with a concurrency semaphore."""
        sem = asyncio.Semaphore(concurrency)
        log.info("agent.queue_start", role=self.ROLE, concurrency=concurrency)

        if self.TIER == "architect":
            async with httpx.AsyncClient() as ac:
                while not queue.empty():
                    task = await queue.get()
                    async with sem:
                        await self.run_task(task, anthropic_client=ac)
                    queue.task_done()
        else:
            async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as oc:
                while not queue.empty():
                    task = await queue.get()
                    async with sem:
                        await self.run_task(task, ollama_client=oc)
                    queue.task_done()

        log.info("agent.queue_done", role=self.ROLE)
