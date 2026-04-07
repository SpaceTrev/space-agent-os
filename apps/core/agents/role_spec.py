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

# Primary: Claude Max via local proxy (claude-max-api-proxy at localhost:3456)
#   Start with: claude auth login && claude-max-api
#   Then set PRIMARY_BACKEND=claude_max in .env
CLAUDE_MAX_PROXY_URL: str = os.getenv("CLAUDE_MAX_PROXY_URL", "http://localhost:3456/v1")
CLAUDE_MAX_MODEL: str = "claude-sonnet-4"   # proxy model name

# Fallback: Anthropic API key (if someone has one)
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
PRIMARY_MODEL: str = os.getenv("PRIMARY_MODEL", "claude-sonnet-4-6")

# Secondary: Gemini
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
SECONDARY_MODEL: str = os.getenv("SECONDARY_MODEL", "gemini-2.0-flash")

# Local: Ollama
OLLAMA_ENABLED: bool = os.getenv("OLLAMA_ENABLED", "false").lower() == "true"
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ORCHESTRATOR_MODEL: str = os.getenv("ORCHESTRATOR_MODEL", "llama3.1:8b")
WORKER_MODEL: str = os.getenv("WORKER_MODEL", "qwen3-coder:30b")

# Which backend to use (claude_max | anthropic | ollama)
PRIMARY_BACKEND: str = os.getenv("PRIMARY_BACKEND", "ollama")


def _probe_claude_max_proxy() -> bool:
    """Check if the Claude Max proxy is reachable (sync, fast)."""
    import urllib.request
    try:
        url = CLAUDE_MAX_PROXY_URL.replace("/v1", "") + "/health"
        urllib.request.urlopen(url, timeout=2)
        return True
    except Exception:
        return False


def _resolve_model(tier: "ModelTier") -> tuple[str, str]:
    """
    Return (backend, model_name) for the given tier.

    Resolution order:
      1. claude_max  — Claude Max subscription via local proxy (PRIMARY_BACKEND=claude_max)
      2. anthropic   — Direct Anthropic API key (PRIMARY_BACKEND=anthropic)
      3. ollama      — Local Ollama (PRIMARY_BACKEND=ollama or OLLAMA_ENABLED=true)
      4. Raise       — nothing configured
    """
    backend = PRIMARY_BACKEND.lower()

    if backend == "claude_max":
        return "claude_max", CLAUDE_MAX_MODEL

    if backend == "anthropic" and ANTHROPIC_API_KEY:
        return "anthropic", PRIMARY_MODEL

    if backend == "ollama" or OLLAMA_ENABLED:
        if tier == ModelTier.ORCHESTRATOR:
            return "ollama", ORCHESTRATOR_MODEL
        return "ollama", WORKER_MODEL

    raise RuntimeError(
        "No LLM backend active. Options:\n"
        "  • Claude Max: run 'claude auth login && claude-max-api', set PRIMARY_BACKEND=claude_max\n"
        "  • Anthropic API: set ANTHROPIC_API_KEY + PRIMARY_BACKEND=anthropic\n"
        "  • Ollama: set OLLAMA_ENABLED=true + PRIMARY_BACKEND=ollama"
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

    if backend == "claude_max":
        return await _call_openai_compat(model, spec.system_prompt, prompt, context, base_url=CLAUDE_MAX_PROXY_URL)
    if backend == "anthropic":
        return await _call_anthropic(spec, prompt, context, model)
    if backend == "ollama":
        return await _call_ollama(model, spec.system_prompt, prompt, context)

    raise RuntimeError(f"Unknown backend: {backend}")


async def _call_openai_compat(
    model: str,
    system_prompt: str,
    prompt: str,
    context: str,
    base_url: str = "http://localhost:3456/v1",
) -> str:
    """Call any OpenAI-compatible endpoint (Claude Max proxy, LiteLLM, etc.)."""
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if context.strip():
        messages.append({"role": "user", "content": f"Context:\n{context}"})
        messages.append({"role": "assistant", "content": "Context received. Ready."})
    messages.append({"role": "user", "content": prompt})

    payload = {"model": model, "messages": messages, "max_tokens": 4096}
    async with httpx.AsyncClient(base_url=base_url, timeout=120.0) as client:
        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


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
    """Return observable health dict for /status and Mission Control."""
    proxy_reachable = _probe_claude_max_proxy() if PRIMARY_BACKEND == "claude_max" else False

    status: dict[str, Any] = {
        "primary_backend": PRIMARY_BACKEND,
        "claude_max_proxy": CLAUDE_MAX_PROXY_URL,
        "claude_max_proxy_reachable": proxy_reachable,
        "anthropic_configured": bool(ANTHROPIC_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY),
        "ollama_enabled": OLLAMA_ENABLED,
        "ollama_url": OLLAMA_BASE_URL,
        "orchestrator_model": ORCHESTRATOR_MODEL,
        "worker_model": WORKER_MODEL,
    }

    if PRIMARY_BACKEND == "claude_max":
        if proxy_reachable:
            status["active_backend"] = "claude_max"
            status["active_model"] = CLAUDE_MAX_MODEL
        else:
            status["active_backend"] = "claude_max (proxy down)"
            status["active_model"] = "—"
            status["warning"] = "Proxy unreachable. Run: claude auth login && claude-max-api"
    elif PRIMARY_BACKEND == "anthropic" and ANTHROPIC_API_KEY:
        status["active_backend"] = "anthropic"
        status["active_model"] = PRIMARY_MODEL
    elif OLLAMA_ENABLED or PRIMARY_BACKEND == "ollama":
        status["active_backend"] = "ollama"
        status["active_model"] = WORKER_MODEL
    else:
        status["active_backend"] = "none"
        status["active_model"] = "—"
        status["warning"] = "No LLM backend active."

    return status


# ─── BaseAgent ────────────────────────────────────────────────────────────────


class BaseAgent:
    """
    Minimal async agent.  All roster agents subclass this.

    Subclasses define:
      SPEC: RoleSpec  — class-level constant describing the agent's role

    Optionally override:
      run()  — for agents that need custom multi-step logic

    Brain integration:
      If brain_context=True (default), the agent auto-hydrates a brain context
      packet from brain/ vault before each LLM call, using the agent's department
      and the task description for relevance selection.
      Disable with brain_context=False or set BRAIN_ENABLED=false env var.
    """

    SPEC: RoleSpec  # must be set by each subclass
    brain_context: bool = True  # subclasses can opt out

    # Shared assembler — loaded once per process, reused across all agents
    _brain_assembler: "Any | None" = None  # brain.assembler.BrainAssembler

    @classmethod
    def _get_assembler(cls) -> "Any | None":
        """Lazy-load the BrainAssembler (import deferred to avoid circular deps)."""
        brain_enabled = os.getenv("BRAIN_ENABLED", "true").lower() == "true"
        if not brain_enabled:
            return None
        if cls._brain_assembler is None:
            try:
                # Import here to keep role_spec.py free of hard brain dependency
                import sys
                _core = Path(__file__).parent.parent
                if str(_core) not in sys.path:
                    sys.path.insert(0, str(_core))
                from brain.assembler import BrainAssembler
                cls._brain_assembler = BrainAssembler()
                log.info("agent.brain_loaded", docs=len(cls._brain_assembler.loader.all_docs))
            except Exception as exc:
                log.warning("agent.brain_unavailable", error=str(exc))
                cls._brain_assembler = False  # type: ignore[assignment]  # sentinel
        return cls._brain_assembler if cls._brain_assembler else None

    async def run(self, task: str, context: str = "") -> AgentResult:
        """Execute task, return AgentResult.  Override for multi-step logic."""
        import asyncio

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

        # ── Brain context hydration ────────────────────────────────────────
        enriched_context = context
        if self.brain_context:
            assembler = self._get_assembler()
            if assembler is not None:
                try:
                    brain_ctx = assembler.build(
                        department=self.SPEC.department,
                        task=task,
                        extra_context=context,
                    )
                    enriched_context = brain_ctx
                    log.debug(
                        "agent.brain_context_injected",
                        agent=self.SPEC.name,
                        ctx_chars=len(brain_ctx),
                    )
                except Exception as exc:
                    log.warning("agent.brain_context_error", agent=self.SPEC.name, error=str(exc))

        error: str | None = None
        output = ""
        try:
            output = await call_llm(self.SPEC, task, enriched_context)
        except Exception as exc:
            error = str(exc)
            log.error("agent.error", agent=self.SPEC.name, error=error)

        elapsed = round(time.monotonic() - start, 3)
        log.info("agent.done", agent=self.SPEC.name, elapsed_s=elapsed, chars=len(output))

        result = AgentResult(
            agent_name=self.SPEC.name,
            output=output,
            model_used=model_used,
            elapsed_s=elapsed,
            error=error,
        )

        # ── Post-task hook: skill extraction + audit (fire-and-forget) ─────
        try:
            from brain.hooks import schedule_after_task
            schedule_after_task(task, result)
        except Exception:
            pass  # hooks failure is never fatal

        return result
