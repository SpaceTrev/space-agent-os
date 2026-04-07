"""TeamOrchestrator — manages a named team of agents.

A team has:
  - A lead agent (receives the initial task)
  - A set of specialist agents (receive delegated subtasks)
  - A shared asyncio.Queue for task dispatch

The lead decomposes work; specialists execute; all results aggregate back.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from dataclasses import dataclass, field
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
class TeamTask:
    """A task within a team execution run."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    description: str = ""
    priority: str = "NORMAL"
    tags: list[str] = field(default_factory=list)
    assigned_role: str | None = None
    result: str | None = None
    error: str | None = None


@dataclass
class TeamConfig:
    """Static configuration for a named team."""
    name: str
    lead: BaseAgent
    specialists: list[BaseAgent]
    max_concurrency: int = 3


class TeamOrchestrator:
    """Routes tasks to the right specialist within a team."""

    def __init__(self, config: TeamConfig) -> None:
        self._cfg = config
        self._queue: asyncio.Queue[TeamTask] = asyncio.Queue()
        self._results: list[TeamTask] = []

    # ── Public API ────────────────────────────────────────────────────────────

    async def run(self, goal: str) -> list[TeamTask]:
        """
        Full team execution cycle:
        1. Lead agent decomposes the goal into subtasks (one per line)
        2. Each subtask is dispatched to the most appropriate specialist
        3. Results collected and returned
        """
        log.info("team.run_start", team=self._cfg.name, goal=goal[:80])

        # Step 1: lead decomposes
        subtasks = await self._decompose(goal)
        log.info("team.decomposed", team=self._cfg.name, subtask_count=len(subtasks))

        # Step 2: enqueue
        for st in subtasks:
            await self._queue.put(st)

        # Step 3: dispatch with concurrency limit
        sem = asyncio.Semaphore(self._cfg.max_concurrency)
        workers = [
            asyncio.create_task(self._dispatch(sem))
            for _ in range(min(self._cfg.max_concurrency, len(subtasks)))
        ]
        await self._queue.join()
        for w in workers:
            w.cancel()

        log.info(
            "team.run_done",
            team=self._cfg.name,
            completed=len([r for r in self._results if r.error is None]),
            failed=len([r for r in self._results if r.error]),
        )
        return list(self._results)

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _decompose(self, goal: str) -> list[TeamTask]:
        """Ask the lead agent to break the goal into one subtask per line."""
        prompt = (
            f"Break this goal into concrete subtasks, one per line. "
            f"Each line: [ROLE] description (where ROLE is one of: "
            f"{', '.join(a.ROLE for a in self._cfg.specialists)}).\n\nGoal: {goal}"
        )
        raw = await self._cfg.lead.run_task({"id": "decompose", "description": prompt})
        tasks = []
        for line in raw.strip().splitlines():
            line = line.strip().lstrip("- ").strip()
            if not line:
                continue
            role: str | None = None
            if line.startswith("["):
                end = line.find("]")
                if end > 0:
                    role = line[1:end].strip()
                    line = line[end + 1:].strip()
            tasks.append(TeamTask(description=line, assigned_role=role))
        return tasks or [TeamTask(description=goal)]

    async def _dispatch(self, sem: asyncio.Semaphore) -> None:
        """Worker coroutine: pull tasks and route to best specialist."""
        while True:
            task = await self._queue.get()
            async with sem:
                agent = self._pick_agent(task)
                try:
                    result = await agent.run_task({
                        "id": task.id,
                        "description": task.description,
                        "priority": task.priority,
                        "tags": task.tags,
                    })
                    task.result = result
                except Exception as exc:
                    task.error = str(exc)
                    log.error("team.task_error", task_id=task.id, error=task.error)
                self._results.append(task)
            self._queue.task_done()

    def _pick_agent(self, task: TeamTask) -> BaseAgent:
        """Pick the best specialist for a task by role match or fallback."""
        if task.assigned_role:
            for agent in self._cfg.specialists:
                if task.assigned_role.lower() in agent.ROLE.lower():
                    return agent
        # Fallback: first available specialist
        return self._cfg.specialists[0] if self._cfg.specialists else self._cfg.lead
