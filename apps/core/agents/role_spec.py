"""
role_spec.py — Foundation types for the Space-Claw agent system.

Exports:
  ModelTier    — ORCHESTRATOR / WORKER / ARCHITECT tiers
  RoleSpec     — agent identity: name, dept, system prompt, model tier, tools
  AgentResult  — output of a single agent invocation
  BaseAgent    — minimal async agent that runs a task given a RoleSpec
  call_llm     — routes to Ollama (orchestrator/worker) or Anthropic (architect)

All roster agents import from here so these types are the single source of truth.
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

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ORCHESTRATOR_MODEL: str = os.getenv("ORCHESTRATOR_MODEL", "llama3.3:8b")
WORKER_MODEL: str = os.getenv("WORKER_MODEL", "qwen3-coder:30b-a3b")
ARCHITECT_MODEL: str = os.getenv("ARCHITECT_MODEL", "claude-opus-4-6")


# ─── Enums ───────────────────────────────────────────────────────────────────


class ModelTier(str, enum.Enum):
    """Maps agent roles to the three compute tiers."""

    ORCHESTRATOR = "orchestrator"  # llama3.3:8b  — routing, triage, heartbeat
    WORKER = "worker"              # qwen3-coder:30b-a3b — code, logic, build
    ARCHITECT = "architect"        # claude-opus-4-6 — deep reasoning, design


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

    # ── YAML loading ────────────────────────────────────────────────────────

    @classmethod
    def from_yaml(cls, path: Path) -> "RoleSpec":
        """Load a RoleSpec from a YAML file.  Requires PyYAML (pyyaml)."""
        try:
            import yaml  # lazy import — only needed for dynamic roles
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
    Route a prompt to the correct model tier.

    - ORCHESTRATOR / WORKER → Ollama (local, zero token cost)
    - ARCHITECT              → Anthropic claude-opus-4-6
    """
    if spec.model_tier == ModelTier.ARCHITECT:
        return await _call_anthropic(spec, prompt, context)

    model = ORCHESTRATOR_MODEL if spec.model_tier == ModelTier.ORCHESTRATOR else WORKER_MODEL
    return await _call_ollama(model, spec.system_prompt, prompt, context)


async def _call_ollama(
    model: str,
    system_prompt: str,
    prompt: str,
    context: str,
) -> str:
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


async def _call_anthropic(spec: RoleSpec, prompt: str, context: str) -> str:
    try:
        import anthropic  # lazy import — only used for architect tier
    except ImportError as exc:
        raise ImportError("anthropic package required for ARCHITECT tier") from exc

    client = anthropic.AsyncAnthropic()
    messages: list[dict[str, str]] = []
    if context.strip():
        messages.append({"role": "user", "content": f"Context:\n{context}"})
        messages.append({"role": "assistant", "content": "Context received. Ready for your task."})
    messages.append({"role": "user", "content": prompt})

    response = await client.messages.create(
        model=ARCHITECT_MODEL,
        max_tokens=4096,
        system=spec.system_prompt,
        messages=messages,  # type: ignore[arg-type]
    )
    return response.content[0].text  # type: ignore[union-attr]


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
        model_used = (
            ARCHITECT_MODEL
            if self.SPEC.model_tier == ModelTier.ARCHITECT
            else (ORCHESTRATOR_MODEL if self.SPEC.model_tier == ModelTier.ORCHESTRATOR else WORKER_MODEL)
        )
        log.info(
            "agent.run",
            agent=self.SPEC.name,
            tier=self.SPEC.model_tier.value,
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
