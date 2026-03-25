"""
team_orchestrator.py — Manages one team of agents working on a problem.

A team is an ordered list of agents.  The orchestrator runs them either
sequentially (each agent's output becomes the next agent's context) or in
parallel (all agents receive the same input; results are merged).

Usage:
    from orchestration.team_orchestrator import TeamOrchestrator, TeamConfig
    from agents.roster import ContextAgent, PMAgent, PlannerAgent

    config = TeamConfig(
        name="pipeline",
        agents=[ContextAgent(), PMAgent(), PlannerAgent()],
        mode="sequential",
    )
    orchestrator = TeamOrchestrator(config)
    result = await orchestrator.run("Build a user authentication system")
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Literal

import structlog

from agents.role_spec import AgentResult, BaseAgent

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()


# ─── Types ────────────────────────────────────────────────────────────────────


@dataclass
class TeamConfig:
    """Defines a team: its name, member agents, and execution strategy."""

    name: str
    agents: list[BaseAgent]
    mode: Literal["sequential", "parallel"] = "sequential"
    description: str = ""


@dataclass
class TeamResult:
    """Aggregated output of a full team run."""

    team_name: str
    agent_results: list[AgentResult]
    final_output: str
    elapsed_s: float
    error: str | None = None

    @property
    def success(self) -> bool:
        return self.error is None and all(r.success for r in self.agent_results)

    def summary(self) -> str:
        lines = [f"**Team: {self.team_name}** ({self.elapsed_s:.1f}s)"]
        for r in self.agent_results:
            status = "✅" if r.success else "❌"
            lines.append(f"  {status} **{r.agent_name}** — {r.summary(120)}")
        return "\n".join(lines)


# ─── Team Orchestrator ────────────────────────────────────────────────────────


class TeamOrchestrator:
    """
    Coordinates a single team of agents.

    Sequential mode: agent[0] → output → agent[1] (context) → … → agent[n]
    Parallel mode:   all agents run simultaneously; outputs are joined.
    """

    def __init__(self, config: TeamConfig) -> None:
        self._cfg = config

    async def run(self, task: str, initial_context: str = "") -> TeamResult:
        log.info(
            "team.start",
            team=self._cfg.name,
            mode=self._cfg.mode,
            agents=[a.SPEC.name for a in self._cfg.agents],
        )
        start = time.monotonic()
        results: list[AgentResult] = []
        error: str | None = None
        final_output = ""

        try:
            if self._cfg.mode == "sequential":
                results, final_output = await self._run_sequential(task, initial_context)
            else:
                results, final_output = await self._run_parallel(task, initial_context)
        except Exception as exc:
            error = str(exc)
            log.exception("team.error", team=self._cfg.name, error=error)
            final_output = f"Team '{self._cfg.name}' encountered an error: {error}"

        elapsed = round(time.monotonic() - start, 3)
        log.info("team.done", team=self._cfg.name, elapsed_s=elapsed, success=error is None)

        return TeamResult(
            team_name=self._cfg.name,
            agent_results=results,
            final_output=final_output,
            elapsed_s=elapsed,
            error=error,
        )

    async def _run_sequential(
        self, task: str, initial_context: str
    ) -> tuple[list[AgentResult], str]:
        """Chain agents: each output feeds the next as context."""
        results: list[AgentResult] = []
        context = initial_context

        for agent in self._cfg.agents:
            result = await agent.run(task, context)
            results.append(result)
            if result.success:
                # Accumulate context: prior agent's output enriches the next
                context = _build_context(context, result)
            else:
                log.warning(
                    "team.agent_failed",
                    team=self._cfg.name,
                    agent=result.agent_name,
                    error=result.error,
                )
                # Continue with remaining agents using what context we have

        final_output = results[-1].output if results else ""
        return results, final_output

    async def _run_parallel(
        self, task: str, initial_context: str
    ) -> tuple[list[AgentResult], str]:
        """Run all agents simultaneously; join outputs."""
        coros = [agent.run(task, initial_context) for agent in self._cfg.agents]
        results: list[AgentResult] = await asyncio.gather(*coros)
        final_output = _merge_parallel_outputs(results)
        return list(results), final_output


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _build_context(prior_context: str, result: AgentResult) -> str:
    """Append a completed agent's output to the running context string."""
    section = f"### {result.agent_name} output:\n{result.output}"
    if prior_context.strip():
        return f"{prior_context}\n\n{section}"
    return section


def _merge_parallel_outputs(results: list[AgentResult]) -> str:
    """Join parallel agent outputs with clear section headers."""
    parts: list[str] = []
    for r in results:
        status = "✅" if r.success else f"❌ ERROR: {r.error}"
        parts.append(f"### {r.agent_name} ({status})\n{r.output}")
    return "\n\n---\n\n".join(parts)
