"""
role_spec.py — Foundation types for the Space-Claw agent system.

Exports:
  ModelTier    — ORCHESTRATOR / WORKER / ARCHITECT tiers
  RoleSpec     — agent identity: name, dept, system prompt, model tier, tools
  AgentResult  — output of a single agent invocation
  BaseAgent    — minimal async agent that runs a task given a RoleSpec
  call_llm     — routes to the correct backend based on model strategy

Model strategy (see apps/core/config/models.yml):
  Primary:   Claude Sonnet 4.6 via Anthropic API (ANTHROPIC_API_KEY)
  Secondary: Gemini 2.0 Flash via Google API     (GEMINI_API_KEY)
  Local:     Ollama                              (OLLAMA_ENABLED=true)

All roster agents import from here — single source of truth.
"""
from __future__ import annotations

import enum
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ─── Config ──────────────────────────────────────────────────────────────────

# Primary: Claude via Anthropic API
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
PRIMARY_MODEL: str = os.getenv("PRIMARY_MODEL", "claude-sonnet-4-6")

# Secondary: Gemini
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
SECONDARY_MODEL: str = os.getenv("SECONDARY_MODEL", "gemini-2.0-flash")

# Local: Ollama (off by default)
OLLAMA_ENABLED: bool = os.getenv("OLLAMA_ENABLED", "false").lower() == "true"
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ORCHESTRATOR_MODEL: str = os.getenv("ORCHESTRATOR_MODEL", "llama3.1:8b")
WORKER_MODEL: str = os.getenv("WORKER_MODEL", "qwen3-coder:30b")


def _resolve_model(tier: "ModelTier") -> tuple[str, str]:
    """
    Return (backend, model_name) for the given tier using available credentials.

    Resolution order:
      1. Anthropic API (if ANTHROPIC_API_KEY set)
      2. Ollama         (if OLLAMA_ENABLED=true)
      3. Raise          (no working backend configured)
    """
    if ANTHROPIC_API_KEY:
        return "anthropic", PRIMARY_MODEL

    if OLLAMA_ENABLED:
        if tier == ModelTier.ORCHESTRATOR:
            return "ollama", ORCHESTRATOR_MODEL
        return "ollama", WORKER_MODEL

    raise RuntimeError(
        "No LLM backend configured. Set ANTHROPIC_API_KEY in .env, "
        "or set OLLAMA_ENABLED=true to use local Ollama models."
    )


# ─── Enums ───────────────────────────────────────────────────────────────────


class ModelTier(str, enum.Enum):
    """Maps agent roles to the three compute tiers."""

    ORCHESTRATOR = "orchestrator"  # routing, triage, heartbeat — fast/cheap
    WORKER = "worker"              # code gen, logic, content — capable
    ARCHITECT = "architect"        # deep reasoning, design, review — best available


# ─── RoleSpec ─────────────────────────────────────────────────────────────────


@dataclass
class RoleSpec:
    """
    Defines everything about an agent role.

    Can be constructed in code (for built-in roster agents) or loaded from a
    YAML file in config/roles/ (for dynamic domain agents).
    """

    name: str
    department: str
    expertise: str
    system_prompt: str
    model_tier: ModelTier
    tools: list[str] = field(default_factory=list)
    memory_namespace: str = ""

    @classmethod
    def from_yaml(cls, path: Path) -> "RoleSpec":
        """Load a RoleSpec from a YAML file.  Requires PyYAML (pyyaml)."""
        try:
            import yaml
        except ImportError as exc:
            raise ImportError("pyyaml is required for YAML role loading: uv add pyyaml") from exc

        data: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
        data["model_tier"] = ModelTier(data["model_tier"])
        data.setdefault("tools", [])
        data.setdefault("memory_namespace", "")
        return cls(**data)

    @classmethod
    def load_all(cls, roles_dir: Path) -> dict[str, "RoleSpec"]:
        """Load every *.yaml in roles_dir into a name→RoleSpec mapping."""
        specs: dict[str, RoleSpec] = {}
        for yaml_file in sorted(roles_dir.glob("*.yaml")):
            try:
                spec = cls.from_yaml(yaml_file)
                specs[spec.name] = spec
                log.debug("role_spec.loaded", name=spec.name, file=yaml_file.name)
            except Exception:
                log.exception("role_spec.load_error", file=str(yaml_file))
        return specs


# ─── AgentResult ──────────────────────────────────────────────────────────────


@dataclass
class AgentResult:
    """Returned by BaseAgent.run() and used throughout the orchestration layer."""

    agent_name: str
    output: str
    model_used: str
    elapsed_s: float
    error: str | None = None

    @property
    def success(self) -> bool:
        return self.error is None

    def summary(self, max_chars: int = 200) -> str:
        """Short preview for logging / Discord embeds."""
        text = self.output[:max_chars]
        if len(self.output) > max_chars:
            text += "…"
        return text


# ─── LLM routing ─────────────────────────────────────────────────────────────


async def call_llm(
    spec: RoleSpec,
    prompt: str,
    context: str = "",
) -> str:
    """
    Route a prompt to the best available backend for this tier.

    Resolution: Anthropic (primary) → Ollama (local fallback).
    """
    backend, model = _resolve_model(spec.model_tier)

    log.debug("call_llm.route", agent=spec.name, tier=spec.model_tier.value, backend=backend, model=model)

    if backend == "anthropic":
        return await _call_anthropic(spec, prompt, context, model)
    if backend == "ollama":
        return await _call_ollama(model, spec.system_prompt, prompt, context)

    raise RuntimeError(f"Unknown backend: {backend}")


async def _call_anthropic(
    spec: RoleSpec,
    prompt: str,
    context: str,
    model: str = PRIMARY_MODEL,
) -> str:
    """Call Anthropic Messages API (claude-sonnet-4-6 or configured model)."""
    try:
        import anthropic
    except ImportError as exc:
        raise ImportError("anthropic package required: uv add anthropic") from exc

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    messages: list[dict[str, str]] = []
    if context.strip():
        messages.append({"role": "user", "content": f"Context:\n{context}"})
        messages.append({"role": "assistant", "content": "Context received. Ready for your task."})
    messages.append({"role": "user", "content": prompt})

    response = await client.messages.create(
        model=model,
        max_tokens=4096,
        system=spec.system_prompt,
        messages=messages,  # type: ignore[arg-type]
    )
    return response.content[0].text  # type: ignore[union-attr]


async def _call_ollama(
    model: str,
    system_prompt: str,
    prompt: str,
    context: str,
) -> str:
    """Call local Ollama /api/generate."""
    full_prompt = f"Context:\n{context}\n\n---\n\n{prompt}" if context.strip() else prompt
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
        resp = await client.post(
            "/api/generate",
            json={
                "model": model,
                "prompt": full_prompt,
                "system": system_prompt,
                "stream": False,
            },
            timeout=180.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


# ─── Backend status (for /status command + Mission Control) ──────────────────


def get_backend_status() -> dict[str, Any]:
    """
    Return a dict describing which backends are configured and active.
    Used by CentralBrain.status() and the Discord /status command.
    """
    status: dict[str, Any] = {
        "primary_model": PRIMARY_MODEL,
        "anthropic_configured": bool(ANTHROPIC_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY),
        "ollama_enabled": OLLAMA_ENABLED,
        "ollama_url": OLLAMA_BASE_URL,
        "orchestrator_model": ORCHESTRATOR_MODEL,
        "worker_model": WORKER_MODEL,
    }

    # Determine active backend
    if ANTHROPIC_API_KEY:
        status["active_backend"] = "anthropic"
        status["active_model"] = PRIMARY_MODEL
    elif OLLAMA_ENABLED:
        status["active_backend"] = "ollama"
        status["active_model"] = WORKER_MODEL
    else:
        status["active_backend"] = "none"
        status["active_model"] = "—"
        status["warning"] = "No LLM backend configured. Set ANTHROPIC_API_KEY in .env."

    return status


# ─── BaseAgent ────────────────────────────────────────────────────────────────


class BaseAgent:
    """
    Minimal async agent.  All roster agents subclass this.

    Subclasses define:
      SPEC: RoleSpec  — class-level constant describing the agent's role

    Optionally override:
      run()  — for agents that need custom multi-step logic
    """

    SPEC: RoleSpec  # must be set by each subclass

    async def run(self, task: str, context: str = "") -> AgentResult:
        """Execute task, return AgentResult.  Override for multi-step logic."""
        start = time.monotonic()

        backend, model_used = _resolve_model(self.SPEC.model_tier)
        log.info(
            "agent.run",
            agent=self.SPEC.name,
            tier=self.SPEC.model_tier.value,
            backend=backend,
            model=model_used,
            task_preview=task[:80],
        )

        error: str | None = None
        output = ""
        try:
            output = await call_llm(self.SPEC, task, context)
        except Exception as exc:
            error = str(exc)
            log.error("agent.error", agent=self.SPEC.name, error=error)

        elapsed = round(time.monotonic() - start, 3)
        log.info("agent.done", agent=self.SPEC.name, elapsed_s=elapsed, chars=len(output))
        return AgentResult(
            agent_name=self.SPEC.name,
            output=output,
            model_used=model_used,
            elapsed_s=elapsed,
            error=error,
        )
