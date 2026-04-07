"""SwarmCoordinator — parallel fan-out execution across multiple agent instances.

Use this when you need to run the same task (or slight variations) across
multiple agents in parallel and aggregate their results:
  - Parallel code generation with best-of-N selection
  - Multi-agent debate / consensus
  - Parallel research across different search angles
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any

import structlog

from agents.base_agent import BaseAgent

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()


@dataclass
class SwarmResult:
    """Result from a single swarm participant."""
    agent_role: str
    task_id: str
    output: str
    elapsed_s: float
    error: str | None = None


@dataclass
class SwarmRun:
    """Aggregated output from a full swarm run."""
    run_id: str
    goal: str
    results: list[SwarmResult]

    @property
    def successful(self) -> list[SwarmResult]:
        return [r for r in self.results if r.error is None]

    @property
    def failed(self) -> list[SwarmResult]:
        return [r for r in self.results if r.error is not None]

    def best(self) -> SwarmResult | None:
        """Return the longest successful output (naive quality heuristic)."""
        candidates = self.successful
        if not candidates:
            return None
        return max(candidates, key=lambda r: len(r.output))


class SwarmCoordinator:
    """Fan-out a task across a pool of agents and aggregate results."""

    def __init__(self, agents: list[BaseAgent]) -> None:
        if not agents:
            raise ValueError("SwarmCoordinator requires at least one agent")
        self._agents = agents

    async def run(
        self,
        goal: str,
        *,
        variants: list[str] | None = None,
        timeout: float = 120.0,
    ) -> SwarmRun:
        """
        Fan out `goal` (or `variants[i]` per agent) across all agents in parallel.

        Args:
            goal:     Base task description sent to all agents (if no variants).
            variants: Optional per-agent prompt variations. len(variants) must
                      equal len(self._agents) if provided.
            timeout:  Per-agent timeout in seconds.

        Returns:
            SwarmRun with all results collected.
        """
        run_id = str(uuid.uuid4())[:8]
        log.info(
            "swarm.start",
            run_id=run_id,
            agents=len(self._agents),
            goal=goal[:80],
        )

        if variants and len(variants) != len(self._agents):
            raise ValueError(
                f"variants length ({len(variants)}) must match agents ({len(self._agents)})"
            )

        tasks = []
        for i, agent in enumerate(self._agents):
            prompt = (variants[i] if variants else goal)
            task_dict: dict[str, Any] = {
                "id": f"{run_id}-{i}",
                "description": prompt,
                "tags": ["swarm", run_id],
            }
            tasks.append(self._run_with_timeout(agent, task_dict, timeout=timeout))

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: list[SwarmResult] = []
        for i, (agent, res) in enumerate(zip(self._agents, raw_results)):
            if isinstance(res, Exception):
                results.append(SwarmResult(
                    agent_role=agent.ROLE,
                    task_id=f"{run_id}-{i}",
                    output="",
                    elapsed_s=0.0,
                    error=str(res),
                ))
            else:
                output, elapsed = res
                results.append(SwarmResult(
                    agent_role=agent.ROLE,
                    task_id=f"{run_id}-{i}",
                    output=output,
                    elapsed_s=elapsed,
                ))

        run = SwarmRun(run_id=run_id, goal=goal, results=results)
        log.info(
            "swarm.done",
            run_id=run_id,
            succeeded=len(run.successful),
            failed=len(run.failed),
        )
        return run

    async def _run_with_timeout(
        self,
        agent: BaseAgent,
        task: dict[str, Any],
        timeout: float,
    ) -> tuple[str, float]:
        """Run a single agent task with a timeout. Returns (output, elapsed_s)."""
        import time
        start = time.monotonic()
        result = await asyncio.wait_for(agent.run_task(task), timeout=timeout)
        elapsed = round(time.monotonic() - start, 3)
        return result, elapsed

    # ── Convenience methods ───────────────────────────────────────────────────

    async def best_of_n(self, goal: str, *, timeout: float = 120.0) -> str:
        """Run the swarm and return the best (longest) successful output."""
        run = await self.run(goal, timeout=timeout)
        best = run.best()
        if best is None:
            errors = "; ".join(r.error or "" for r in run.failed)
            raise RuntimeError(f"All swarm agents failed: {errors}")
        return best.output

    async def consensus(
        self,
        goal: str,
        *,
        judge: BaseAgent,
        timeout: float = 120.0,
    ) -> str:
        """
        Run the swarm then ask a judge agent to synthesise the best answer.
        Good for: multi-agent debate, research synthesis, code selection.
        """
        run = await self.run(goal, timeout=timeout)
        candidates = "\n\n---\n\n".join(
            f"Agent: {r.agent_role}\n{r.output}"
            for r in run.successful
        )
        if not candidates:
            raise RuntimeError("No successful swarm results to synthesise")

        synthesis_prompt = (
            f"Original goal: {goal}\n\n"
            f"The following are {len(run.successful)} candidate answers from different agents:\n\n"
            f"{candidates}\n\n"
            f"Synthesise the best answer, combining the strongest elements. "
            f"Output only the final answer."
        )
        return await judge.run_task({
            "id": f"consensus-{run.run_id}",
            "description": synthesis_prompt,
        })
