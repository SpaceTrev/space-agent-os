"""Event-driven pipeline manager — no polling, no timers."""
from __future__ import annotations

import logging
import os
from typing import Any

import structlog

from .events import EventBus, TaskEvent

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

PIPELINE: list[str] = ["context", "planner", "architect", "engineer", "reviewer", "qa"]


class PipelineManager:
    """Listens for *done* events and immediately fires the next agent in PIPELINE.

    Special terminal transitions:
      - qa  done  → publish ``release`` event (pipeline complete)
      - any failed → publish ``blocked`` event (Discord notification hook)
    """

    def __init__(self, bus: EventBus) -> None:
        self._bus = bus
        for stage in PIPELINE:
            bus.subscribe(stage, self._on_event)

    async def _on_event(self, event: TaskEvent) -> None:
        if event.status == "failed":
            await self._emit_blocked(event)
            return

        if event.status != "done":
            return

        current = event.agent_type
        try:
            idx = PIPELINE.index(current)
        except ValueError:
            log.warning("pipeline.unknown_stage", stage=current)
            return

        if current == "qa":
            await self._emit_release(event)
            return

        next_stage = PIPELINE[idx + 1]
        log.info("pipeline.advance", from_stage=current, to_stage=next_stage, task_id=event.task_id)
        await self._bus.publish(
            TaskEvent(
                task_id=event.task_id,
                agent_type=next_stage,
                status="pending",
                payload=event.payload,
            )
        )

    async def _emit_release(self, event: TaskEvent) -> None:
        log.info("pipeline.release", task_id=event.task_id)
        await self._bus.publish(
            TaskEvent(
                task_id=event.task_id,
                agent_type="release",
                status="release",
                payload=event.payload,
            )
        )

    async def _emit_blocked(self, event: TaskEvent) -> None:
        log.warning("pipeline.blocked", task_id=event.task_id, stage=event.agent_type)
        await self._bus.publish(
            TaskEvent(
                task_id=event.task_id,
                agent_type="blocked",
                status="blocked",
                payload={**event.payload, "failed_stage": event.agent_type},
            )
        )

    async def inject(self, task: dict[str, Any]) -> None:
        """Kick off a fresh pipeline run from the first stage."""
        task_id: str = task.get("id", "")
        log.info("pipeline.inject", task_id=task_id, first_stage=PIPELINE[0])
        await self._bus.publish(
            TaskEvent(
                task_id=task_id,
                agent_type=PIPELINE[0],
                status="pending",
                payload=task,
            )
        )
