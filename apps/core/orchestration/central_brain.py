"""
central_brain.py — The central routing intelligence for Space-Claw.

Responsibilities:
  - Receive IncomingRequest objects (from Discord or API)
  - Classify the request: SINGLE agent / TEAM / SWARM
  - Assemble the right agents, team configs, or swarm config
  - Delegate to TeamOrchestrator or SwarmCoordinator
  - Return a formatted string reply suitable for Discord
  - Expose status() for /status slash command

Classification is done via a fast Ollama prompt (orchestrator tier / llama3.3:8b).

Predefined team presets (all lazy-instantiated):
  pipeline    — context → researcher → pm → planner   (spec + planning)
  engineering — architect → frontend + backend (parallel) → reviewer
  gtm         — marketing + sales (parallel)
  full        — pipeline then engineering (sequential teams)
  design      — designer → frontend
  research    — context + researcher (parallel)

Swarm presets:
  feature     — pipeline + engineering + gtm (all parallel)
  analysis    — research + domain agents
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import structlog

from agents.role_spec import ModelTier, RoleSpec, call_llm

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()


# ─── Classification ───────────────────────────────────────────────────────────


_CLASSIFIER_SPEC = RoleSpec(
    name="classifier",
    department="orchestration",
    expertise="Task classification and routing",
    system_prompt=(
        "You are the Space-Claw Central Brain classifier. "
        "You receive a user request and classify it into exactly one of three scopes:\n\n"
        "SINGLE — one specialist agent can handle this alone\n"
        "TEAM   — requires a coordinated team (e.g. spec writing + coding + review)\n"
        "SWARM  — complex multi-domain problem needing multiple teams in parallel\n\n"
        "Reply with ONLY the word: SINGLE, TEAM, or SWARM"
    ),
    model_tier=ModelTier.ORCHESTRATOR,
)

_AGENT_PICKER_SPEC = RoleSpec(
    name="agent-picker",
    department="orchestration",
    expertise="Agent selection",
    system_prompt=(
        "You are the Space-Claw agent router. "
        "Given a task, choose the single best agent from this list:\n"
        "context, pm, researcher, planner, architect, designer, "
        "frontend, backend, api, reviewer, marketing, sales\n\n"
        "Reply with ONLY the agent name (lowercase, no punctuation)."
    ),
    model_tier=ModelTier.ORCHESTRATOR,
)

_TEAM_PICKER_SPEC = RoleSpec(
    name="team-picker",
    department="orchestration",
    expertise="Team preset selection",
    system_prompt=(
        "You are the Space-Claw team router. "
        "Given a task, choose the best team preset from this list:\n"
        "pipeline  — convert NL request into structured spec + execution plan\n"
        "engineering — architect + code + review\n"
        "gtm       — marketing + sales strategy\n"
        "full      — pipeline then engineering end-to-end\n"
        "design    — UX/UI design + frontend\n"
        "research  — context gathering + deep research\n\n"
        "Reply with ONLY the preset name (lowercase)."
    ),
    model_tier=ModelTier.ORCHESTRATOR,
)

_SWARM_PICKER_SPEC = RoleSpec(
    name="swarm-picker",
    department="orchestration",
    expertise="Swarm preset selection",
    system_prompt=(
        "You are the Space-Claw swarm router. "
        "Given a task, choose the best swarm preset:\n"
        "feature  — pipeline + engineering + gtm all in parallel\n"
        "analysis — research + domain specialist analysis\n\n"
        "Reply with ONLY the preset name (lowercase)."
    ),
    model_tier=ModelTier.ORCHESTRATOR,
)


# ─── Central Brain ────────────────────────────────────────────────────────────


class CentralBrain:
    """
    The top-level router.  Instantiate once; inject into DiscordChannel.

    All heavy imports (agent roster, orchestrators) are deferred so startup
    is fast even if Ollama is not yet reachable.
    """

    async def handle(self, req: "IncomingRequest") -> str:  # type: ignore[name-defined]
        """
        Main entry point.  Classify, route, execute, return formatted reply.
        """
        # Force-route swarm via /swarm prefix
        content = req.content.strip()
        if content.lower().startswith("/swarm "):
            task = content[7:].strip()
            return await self._handle_swarm(task)

        # Classify the request
        scope = await self._classify(content)
        log.info("brain.classified", scope=scope, author=req.author, preview=content[:60])

        if scope == "SINGLE":
            return await self._handle_single(content)
        elif scope == "TEAM":
            return await self._handle_team(content)
        else:
            return await self._handle_swarm(content)

    async def status(self) -> dict[str, str]:
        """Return a status dict for the /status slash command."""
        import httpx
        from agents.role_spec import OLLAMA_BASE_URL, ORCHESTRATOR_MODEL, WORKER_MODEL

        ollama_ok = False
        try:
            async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
                r = await client.get("/", timeout=5.0)
                ollama_ok = r.status_code == 200
        except Exception:
            pass

        return {
            "Ollama": f"{'🟢 Online' if ollama_ok else '🔴 Offline'} — `{OLLAMA_BASE_URL}`",
            "Orchestrator model": f"`{ORCHESTRATOR_MODEL}`",
            "Worker model": f"`{WORKER_MODEL}`",
            "Architect model": "`claude-opus-4-6` (Anthropic)",
            "Teams available": "pipeline, engineering, gtm, full, design, research",
            "Swarms available": "feature, analysis",
        }

    # ── Private routing ────────────────────────────────────────────────────

    async def _classify(self, task: str) -> str:
        """Return 'SINGLE', 'TEAM', or 'SWARM'."""
        try:
            raw = await call_llm(_CLASSIFIER_SPEC, task)
            result = raw.strip().upper().split()[0]
            if result in ("SINGLE", "TEAM", "SWARM"):
                return result
        except Exception as exc:
            log.warning("brain.classify_failed", error=str(exc))
        return "SINGLE"  # safe default

    async def _handle_single(self, task: str) -> str:
        agent_name = await self._pick_agent(task)
        agent = _make_agent(agent_name)
        log.info("brain.single", agent=agent_name)
        result = await agent.run(task)
        if result.success:
            return f"**{result.agent_name}** ({result.elapsed_s:.1f}s)\n\n{result.output}"
        return f"❌ Agent `{result.agent_name}` failed: {result.error}"

    async def _handle_team(self, task: str) -> str:
        preset = await self._pick_team(task)
        team_cfg = _make_team(preset)
        log.info("brain.team", preset=preset)

        from orchestration.team_orchestrator import TeamOrchestrator
        orch = TeamOrchestrator(team_cfg)
        team_result = await orch.run(task)
        return team_result.summary() + f"\n\n---\n\n{team_result.final_output}"

    async def _handle_swarm(self, task: str) -> str:
        preset = await self._pick_swarm(task)
        swarm_cfg = _make_swarm(preset)
        log.info("brain.swarm", preset=preset)

        from orchestration.swarm_coordinator import SwarmCoordinator
        coord = SwarmCoordinator(swarm_cfg)
        swarm_result = await coord.run(task)
        return swarm_result.summary() + f"\n\n---\n\n{swarm_result.synthesized_output}"

    async def _pick_agent(self, task: str) -> str:
        try:
            raw = await call_llm(_AGENT_PICKER_SPEC, task)
            name = raw.strip().lower().split()[0]
            valid = {"context", "pm", "researcher", "planner", "architect",
                     "designer", "frontend", "backend", "api", "reviewer",
                     "marketing", "sales"}
            if name in valid:
                return name
        except Exception as exc:
            log.warning("brain.pick_agent_failed", error=str(exc))
        return "pm"

    async def _pick_team(self, task: str) -> str:
        try:
            raw = await call_llm(_TEAM_PICKER_SPEC, task)
            name = raw.strip().lower().split()[0]
            valid = {"pipeline", "engineering", "gtm", "full", "design", "research"}
            if name in valid:
                return name
        except Exception as exc:
            log.warning("brain.pick_team_failed", error=str(exc))
        return "pipeline"

    async def _pick_swarm(self, task: str) -> str:
        try:
            raw = await call_llm(_SWARM_PICKER_SPEC, task)
            name = raw.strip().lower().split()[0]
            valid = {"feature", "analysis"}
            if name in valid:
                return name
        except Exception as exc:
            log.warning("brain.pick_swarm_failed", error=str(exc))
        return "feature"


# ─── Agent factory ────────────────────────────────────────────────────────────


def _make_agent(name: str) -> "BaseAgent":  # type: ignore[name-defined]
    """Lazy-import and instantiate a single roster agent by short name."""
    from agents.roster import (
        APIExpert, BackendEngineer, ContextAgent, FrontendEngineer,
        LeadArchitect, LeadDesigner, MarketingAgent, PlannerAgent,
        PMAgent, ResearcherAgent, ReviewerAgent, SalesAgent,
    )
    mapping = {
        "context":    ContextAgent,
        "pm":         PMAgent,
        "researcher": ResearcherAgent,
        "planner":    PlannerAgent,
        "architect":  LeadArchitect,
        "designer":   LeadDesigner,
        "frontend":   FrontendEngineer,
        "backend":    BackendEngineer,
        "api":        APIExpert,
        "reviewer":   ReviewerAgent,
        "marketing":  MarketingAgent,
        "sales":      SalesAgent,
    }
    cls = mapping.get(name, PMAgent)
    return cls()


# ─── Team preset factory ──────────────────────────────────────────────────────


def _make_team(preset: str) -> "TeamConfig":  # type: ignore[name-defined]
    from agents.roster import (
        APIExpert, BackendEngineer, ContextAgent, FrontendEngineer,
        LeadArchitect, LeadDesigner, MarketingAgent, PlannerAgent,
        PMAgent, ResearcherAgent, ReviewerAgent, SalesAgent,
    )
    from orchestration.team_orchestrator import TeamConfig

    presets: dict[str, TeamConfig] = {
        "pipeline": TeamConfig(
            name="pipeline",
            description="NL → structured spec → execution plan",
            agents=[ContextAgent(), ResearcherAgent(), PMAgent(), PlannerAgent()],
            mode="sequential",
        ),
        "engineering": TeamConfig(
            name="engineering",
            description="Architecture → code (parallel) → review",
            agents=[
                LeadArchitect(),
                FrontendEngineer(), BackendEngineer(),   # parallel pair
                ReviewerAgent(),
            ],
            # Two middle agents run in parallel; handled by sequential orchestration
            # where both receive the architect's output as context
            mode="sequential",
        ),
        "gtm": TeamConfig(
            name="gtm",
            description="Marketing strategy + sales collateral",
            agents=[MarketingAgent(), SalesAgent()],
            mode="parallel",
        ),
        "full": TeamConfig(
            name="full",
            description="End-to-end: spec + plan + code + review",
            agents=[
                ContextAgent(), ResearcherAgent(), PMAgent(), PlannerAgent(),
                LeadArchitect(), FrontendEngineer(), BackendEngineer(), ReviewerAgent(),
            ],
            mode="sequential",
        ),
        "design": TeamConfig(
            name="design",
            description="UX/UI design → frontend implementation",
            agents=[LeadDesigner(), FrontendEngineer()],
            mode="sequential",
        ),
        "research": TeamConfig(
            name="research",
            description="Context gathering + deep research",
            agents=[ContextAgent(), ResearcherAgent()],
            mode="parallel",
        ),
    }
    return presets.get(preset, presets["pipeline"])


# ─── Swarm preset factory ─────────────────────────────────────────────────────


def _make_swarm(preset: str) -> "SwarmConfig":  # type: ignore[name-defined]
    from orchestration.swarm_coordinator import SwarmConfig

    presets: dict[str, SwarmConfig] = {
        "feature": SwarmConfig(
            name="feature",
            description="Full feature launch: pipeline + engineering + GTM in parallel",
            teams=[
                _make_team("pipeline"),
                _make_team("engineering"),
                _make_team("gtm"),
            ],
            synthesize=True,
        ),
        "analysis": SwarmConfig(
            name="analysis",
            description="Deep analysis: research + context in parallel",
            teams=[
                _make_team("research"),
                _make_team("pipeline"),
            ],
            synthesize=True,
        ),
    }
    return presets.get(preset, presets["feature"])


# ─── Fix circular import: IncomingRequest lives in discord_channel ─────────────

try:
    from channels.discord_channel import IncomingRequest  # noqa: F401
except ImportError:
    pass  # Running without Discord; IncomingRequest is type-hint only here
