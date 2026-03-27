"""Event primitives for the Space-Claw pipeline bus."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

AgentType = str
Status = str  # "pending" | "running" | "done" | "failed" | "release" | "blocked"

Callback = Callable[["TaskEvent"], Awaitable[None]]


@dataclass
class TaskEvent:
    task_id: str
    agent_type: AgentType
    status: Status
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )


class EventBus:
    """Async pub/sub backed by per-subscriber asyncio.Queue instances."""

    def __init__(self) -> None:
        self._subscribers: dict[AgentType, list[asyncio.Queue[TaskEvent]]] = {}

    def subscribe(self, agent_type: AgentType, callback: Callback) -> None:
        """Register *callback* to be called whenever an event for *agent_type* is published.

        Each subscription gets its own queue so slow consumers don't block others.
        The callback is scheduled as an asyncio Task.
        """
        q: asyncio.Queue[TaskEvent] = asyncio.Queue()
        self._subscribers.setdefault(agent_type, []).append(q)

        async def _drain() -> None:
            while True:
                event = await q.get()
                try:
                    await callback(event)
                finally:
                    q.task_done()

        asyncio.ensure_future(_drain())

    async def publish(self, event: TaskEvent) -> None:
        """Broadcast *event* to all subscribers registered for its agent_type."""
        for q in self._subscribers.get(event.agent_type, []):
            await q.put(event)
