"""BaseAgent for the event-driven pipeline.

Each concrete agent:
  1. Sets ``agent_type`` matching its PIPELINE stage name.
  2. Implements ``async def run(task) -> dict`` — returns output payload.
  3. Optionally overrides ``verify`` — default always returns True.

On completion the agent auto-publishes ``done`` or ``failed`` to the bus.
"""
from __future__ import annotations

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import Any

import structlog

from .events import EventBus, TaskEvent

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()


class BaseAgent(ABC):
    """Abstract pipeline agent — subscribe once, handle all pending events."""

    agent_type: str = ""  # must match a PIPELINE stage name

    def __init__(self, bus: EventBus) -> None:
        self._bus = bus
        bus.subscribe(self.agent_type, self._handle)

    # ── subclass contract ─────────────────────────────────────────────────────

    @abstractmethod
    async def run(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute the task and return an output payload dict."""

    async def verify(self, task: dict[str, Any]) -> bool:
        """Run optional shell verification from task[\"verify\"] key.

        Returns True on exit code 0 (or if no verify command is present).
        """
        cmd: str = task.get("verify", "")
        if not cmd:
            return True
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        ok = proc.returncode == 0
        if not ok:
            log.warning(
                "agent.verify_failed",
                agent=self.agent_type,
                task_id=task.get("id", ""),
                cmd=cmd,
                stderr=stderr.decode(errors="replace")[:400],
            )
        return ok

    # ── event handler ─────────────────────────────────────────────────────────

    async def _handle(self, event: TaskEvent) -> None:
        if event.status != "pending":
            return

        task_id = event.task_id
        task = event.payload

        log.info("agent.run_start", agent=self.agent_type, task_id=task_id)

        await self._bus.publish(
            TaskEvent(task_id=task_id, agent_type=self.agent_type, status="running", payload=task)
        )

        try:
            output = await self.run(task)
            verified = await self.verify(task)
            if not verified:
                raise RuntimeError("verify step failed")
        except Exception as exc:
            log.error("agent.run_error", agent=self.agent_type, task_id=task_id, error=str(exc))
            await self._bus.publish(
                TaskEvent(
                    task_id=task_id,
                    agent_type=self.agent_type,
                    status="failed",
                    payload={**task, "error": str(exc)},
                )
            )
            return

        log.info("agent.run_done", agent=self.agent_type, task_id=task_id)
        await self._bus.publish(
            TaskEvent(
                task_id=task_id,
                agent_type=self.agent_type,
                status="done",
                payload={**task, **output},
            )
        )
