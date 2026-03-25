"""
swarm_coordinator.py — Coordinates multiple teams working in parallel.

A swarm is triggered when the CentralBrain classifies a request as requiring
multiple specialised teams operating simultaneously — e.g. an engineering team
building a feature while a research team produces market context and a GTM team
drafts launch copy.

The coordinator:
  1. Spins up each team via TeamOrchestrator (all in parallel)
  2. Aggregates results once all teams complete
  3. Optionally runs a synthesis step (a final agent pass over all results)

Usage:
    from orchestration.swarm_coordinator import SwarmCoordinator, SwarmConfig
    from orchestration.team_orchestrator import TeamConfig
    from agents.roster import ...

    swarm_cfg = SwarmConfig(
        name="full-feature",
        teams=[engineering_team, research_team, gtm_team],
        synthesize=True,
    )
    coordinator = SwarmCoordinator(swarm_cfg)
    result = await coordinator.run("Launch trading dashboard v2")
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field

import structlog

from agents.role_spec import AgentResult, BaseAgent, ModelTier, RoleSpec, call_llm
from orchestration.team_orchestrator import TeamConfig, TeamOrchestrator, TeamResult

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ─── Types ────────────────────────────────────────────────────────────────────


@dataclass
class SwarmConfig:
    """Defines a swarm: its constituent teams and whether to synthesise results."""

    name: str
    teams: list[TeamConfig]
    synthesize: bool = True          # run a final synthesis pass over all outputs
    description: str = ""


@dataclass
class SwarmResult:
    """Aggregated output of all teams in a swarm run."""

    swarm_name: str
    team_results: list[TeamResult]
    synthesized_output: str
    elapsed_s: float
    error: str | None = None

    @property
    def success(self) -> bool:
        return self.error is None

    def summary(self) -> str:
        lines = [f"**Swarm: {self.swarm_name}** ({self.elapsed_s:.1f}s total)\n"]
        for tr in self.team_results:
            lines.append(tr.summary())
        if self.synthesized_output:
            lines.append("\n---\n**Synthesized output:**")
            preview = self.synthesized_output[:500]
            if len(self.synthesized_output) > 500:
                preview += "…"
            lines.append(preview)
        return "\n".join(lines)


# ─── Swarm Coordinator ────────────────────────────────────────────────────────


_SYNTHESIS_SPEC = RoleSpec(
    name="swarm-synthesizer",
    department="orchestration",
    expertise="Cross-team synthesis and executive summarisation",
    system_prompt=(
        "You are the Space-Claw Swarm Synthesizer. "
        "You receive the outputs of multiple specialist teams working on a problem in parallel. "
        "Your job is to synthesize them into a single coherent, actionable summary. "
        "Highlight the most important decisions, identify conflicts between teams, "
        "and produce a clear executive summary followed by ordered next steps."
    ),
    model_tier=ModelTier.ORCHESTRATOR,
)


class SwarmCoordinator:
    """
    Runs multiple teams in parallel and optionally synthesises their outputs.

    Inter-team communication is currently output-only (results are merged at the
    end).  For true inter-team messaging, inject a shared context store here.
    """

    def __init__(self, config: SwarmConfig) -> None:
        self._cfg = config

    async def run(self, task: str, initial_context: str = "") -> SwarmResult:
        log.info(
            "swarm.start",
            swarm=self._cfg.name,
            teams=[t.name for t in self._cfg.teams],
            synthesize=self._cfg.synthesize,
        )
        start = time.monotonic()
        error: str | None = None
        team_results: list[TeamResult] = []
        synthesized_output = ""

        try:
            # Run all teams in parallel
            orchestrators = [TeamOrchestrator(tc) for tc in self._cfg.teams]
            team_results = list(
                await asyncio.gather(*[o.run(task, initial_context) for o in orchestrators])
            )

            if self._cfg.synthesize:
                synthesized_output = await self._synthesize(task, team_results)
            else:
                synthesized_output = _join_team_results(team_results)

        except Exception as exc:
            error = str(exc)
            log.exception("swarm.error", swarm=self._cfg.name, error=error)
            synthesized_output = f"Swarm '{self._cfg.name}' encountered an error: {error}"

        elapsed = round(time.monotonic() - start, 3)
        log.info(
            "swarm.done",
            swarm=self._cfg.name,
            elapsed_s=elapsed,
            teams_completed=len(team_results),
            success=error is None,
        )
        return SwarmResult(
            swarm_name=self._cfg.name,
            team_results=team_results,
            synthesized_output=synthesized_output,
            elapsed_s=elapsed,
            error=error,
        )

    async def _synthesize(self, task: str, team_results: list[TeamResult]) -> str:
        """Use the orchestrator model to synthesise all team outputs."""
        context = _join_team_results(team_results)
        prompt = (
            f"Original task: {task}\n\n"
            "The following teams have completed their work. "
            "Synthesise their outputs into a single coherent result."
        )
        log.info("swarm.synthesizing", swarm=self._cfg.name)
        try:
            return await call_llm(_SYNTHESIS_SPEC, prompt, context)
        except Exception as exc:
            log.error("swarm.synthesis_failed", error=str(exc))
            return context  # fall back to raw concatenation


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _join_team_results(team_results: list[TeamResult]) -> str:
    parts: list[str] = []
    for tr in team_results:
        status = "✅" if tr.success else f"❌ ERROR: {tr.error}"
        parts.append(f"## Team: {tr.team_name} ({status}, {tr.elapsed_s:.1f}s)\n\n{tr.final_output}")
    return "\n\n---\n\n".join(parts)
