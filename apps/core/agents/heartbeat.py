"""Space-Claw Heartbeat Engine

Responsibilities:
  - Publish URGENT/HIGH tasks from TASKS.md onto the EventBus (no polling loop)
  - Listen for task events from channels (WhatsApp, Discord) and publish them
  - Stamp the last-heartbeat footer in TASKS.md after each tick
  - Notify Discord when urgent items are found

Architecture change (2026-03-26):
  OLD: heartbeat → asyncio.Queue → worker (30-min polling loop)
  NEW: heartbeat → EventBus.publish(TaskEvent) → PipelineManager chains stages

Environment vars:
  OPENCLAW_GATEWAY_URL  OpenClaw gateway (default: http://localhost:18789)
  OPENCLAW_TOKEN        Bearer token for gateway API
  HEARTBEAT_INTERVAL    Seconds between ticks (default: 1800)
  LOG_LEVEL             structlog level (default: INFO)
  DISCORD_BOT_TOKEN     Discord bot token
  DISCORD_CHANNEL_ID    Discord channel to notify
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import signal
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import structlog
from agents.intent_router import IntentRouter
from agents.automations.discord_notify import notify as discord_notify
from agents.automations.whatsapp_notify import notify as whatsapp_notify

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

REPO_ROOT = Path(__file__).parent.parent
TASKS_FILE = REPO_ROOT / "TASKS.md"
POLL_INTERVAL_SECONDS: int = int(os.getenv("HEARTBEAT_INTERVAL", "1800"))
OPENCLAW_GATEWAY_URL: str = os.getenv("OPENCLAW_GATEWAY_URL", "http://localhost:18789")
OPENCLAW_TOKEN: str = os.getenv("OPENCLAW_TOKEN", "")
DISCORD_CHANNEL_ID: str = os.getenv("DISCORD_CHANNEL_ID", "")

PRIORITY_RE = re.compile(
    r"^\s*-\s+\[(?P<priority>URGENT|HIGH|NORMAL|LOW)\]\s+(?P<description>.+)$"
)

_intent_router = IntentRouter()


# ---------------------------------------------------------------------------
# TASKS.md helpers
# ---------------------------------------------------------------------------

def parse_tasks(content: str) -> list[dict[str, str]]:
    """Parse TASKS.md → list of {priority, description} dicts."""
    tasks: list[dict[str, str]] = []
    for line in content.splitlines():
        m = PRIORITY_RE.match(line)
        if m:
            tasks.append({
                "priority": m.group("priority"),
                "description": m.group("description").strip(),
            })
    return tasks


def update_heartbeat_timestamp(content: str, ts: str) -> str:
    """Upsert the *Last heartbeat* footer line in TASKS.md."""
    marker = "*Last heartbeat:"
    new_line = f"*Last heartbeat: {ts}*"
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith(marker):
            lines[i] = new_line
            return "\n".join(lines) + "\n"
    return content.rstrip() + f"\n\n---\n{new_line}\n"


# ---------------------------------------------------------------------------
# Channel helpers
# ---------------------------------------------------------------------------

async def fetch_whatsapp_messages(
    client: httpx.AsyncClient,
) -> list[dict[str, Any]]:
    """Poll OpenClaw gateway for inbound messages."""
    if not OPENCLAW_TOKEN:
        log.debug("whatsapp.skip", reason="OPENCLAW_TOKEN not set")
        return []
    try:
        resp = await client.get(
            "/api/messages",
            headers={"Authorization": f"Bearer {OPENCLAW_TOKEN}"},
            timeout=5.0,
        )
        resp.raise_for_status()
        return resp.json().get("messages", [])
    except httpx.ConnectError:
        log.warning("whatsapp.unreachable", url=OPENCLAW_GATEWAY_URL)
        return []
    except httpx.HTTPStatusError as exc:
        log.error("whatsapp.http_error", status=exc.response.status_code)
        return []


async def fetch_urgent_gmail(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """TODO: fetch unread URGENT-labelled Gmail via MCP gmail tool."""
    log.debug("gmail.stub", reason="not yet wired")
    return []


# ---------------------------------------------------------------------------
# HeartbeatEngine — EventBus edition
# ---------------------------------------------------------------------------

class HeartbeatEngine:
    """
    Reads TASKS.md and incoming channel messages; publishes TaskEvents onto
    the EventBus so PipelineManager can chain agents immediately.

    No asyncio.Queue. No direct worker dispatch.
    Every task enters the pipeline at the 'context' stage.
    """

    def __init__(self, bus: "Any | None" = None) -> None:
        """
        Args:
            bus: EventBus instance. If None, runs in standalone mode
                 (logs tasks but doesn't publish events — useful for testing).
        """
        self._bus = bus
        self._stop_event = asyncio.Event()

    def stop(self) -> None:
        log.info("heartbeat.stopping")
        self._stop_event.set()

    async def run(self) -> None:
        log.info("heartbeat.started", interval_s=POLL_INTERVAL_SECONDS)
        async with httpx.AsyncClient(base_url=OPENCLAW_GATEWAY_URL) as client:
            while not self._stop_event.is_set():
                try:
                    await self._tick(client)
                except Exception:
                    log.exception("heartbeat.tick_error")
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=float(POLL_INTERVAL_SECONDS),
                    )
                except asyncio.TimeoutError:
                    pass
        log.info("heartbeat.stopped")

    async def _tick(self, client: httpx.AsyncClient) -> None:
        """Single heartbeat cycle — read tasks, publish events, stamp footer."""
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        log.info("heartbeat.tick", ts=ts)

        # ── TASKS.md ──────────────────────────────────────────────────────────
        content = TASKS_FILE.read_text(encoding="utf-8")
        tasks = parse_tasks(content)

        urgent = [t for t in tasks if t["priority"] in ("URGENT", "HIGH")]
        if urgent:
            log.warning(
                "heartbeat.urgent_tasks",
                count=len(urgent),
                tasks=[t["description"][:60] for t in urgent[:5]],
            )
            # Notify Discord
            lines = "\n".join(f"• [{t['priority']}] {t['description'][:80]}" for t in urgent[:5])
            await discord_notify(f"⚡ **{len(urgent)} urgent task(s) pending:**\n{lines}")

        # Publish URGENT/HIGH onto EventBus for immediate pipeline processing
        if self._bus is not None:
            for task in urgent:
                await self._publish_task(task)

        # ── WhatsApp ──────────────────────────────────────────────────────────
        wa_messages = await fetch_whatsapp_messages(client)
        if wa_messages:
            log.info("whatsapp.messages", count=len(wa_messages))
            await self._dispatch_whatsapp(wa_messages)

        # ── Gmail stub ────────────────────────────────────────────────────────
        await fetch_urgent_gmail(client)

        # ── Stamp footer ──────────────────────────────────────────────────────
        updated = update_heartbeat_timestamp(content, ts)
        TASKS_FILE.write_text(updated, encoding="utf-8")
        log.debug("heartbeat.stamped", ts=ts)

    async def _publish_task(self, task: dict[str, str]) -> None:
        """Publish a TASKS.md entry onto the EventBus at the 'context' stage."""
        from orchestration.events import TaskEvent
        task_id = str(uuid.uuid4())[:8]
        event = TaskEvent(
            task_id=task_id,
            agent_type="context",  # always enter pipeline at context stage
            status="pending",
            payload={
                "description": task["description"],
                "priority": task["priority"],
                "source": "tasks_md",
            },
        )
        log.info(
            "heartbeat.publish",
            task_id=task_id,
            priority=task["priority"],
            description=task["description"][:60],
        )
        await self._bus.publish(event)

    async def _dispatch_whatsapp(self, messages: list[dict[str, Any]]) -> None:
        """Route WhatsApp messages: !task prefix → pipeline, rest → IntentRouter."""
        for msg in messages:
            body: str = msg.get("body", "")
            if not body:
                continue

            if body.startswith("!task "):
                description = body[len("!task "):].strip()
                if description and self._bus is not None:
                    from orchestration.events import TaskEvent
                    task_id = str(uuid.uuid4())[:8]
                    await self._bus.publish(TaskEvent(
                        task_id=task_id,
                        agent_type="context",
                        status="pending",
                        payload={
                            "description": description,
                            "priority": "HIGH",
                            "source": "whatsapp",
                        },
                    ))
                    log.info("whatsapp.task_published", task_id=task_id, description=description)
            else:
                log.info("whatsapp.routing", body=body[:80])
                try:
                    result = await _intent_router.dispatch(body)
                    await whatsapp_notify(result)
                except Exception:
                    log.exception("whatsapp.dispatch_error", body=body[:80])


# ---------------------------------------------------------------------------
# Entry point — wires EventBus + PipelineManager + HeartbeatEngine
# ---------------------------------------------------------------------------

async def main() -> None:
    """
    Bootstrap the full event-driven pipeline:
      EventBus → PipelineManager (chains context→planner→...→qa→release)
      HeartbeatEngine → publishes TaskEvents onto the bus
    """
    from orchestration.events import EventBus
    from orchestration.pipeline import PipelineManager

    bus = EventBus()
    pipeline = PipelineManager(bus)  # noqa: F841 — subscribes on construction
    engine = HeartbeatEngine(bus=bus)

    loop = asyncio.get_running_loop()

    def _handle_signal() -> None:
        log.info("signal.received")
        engine.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_signal)

    log.info("heartbeat.main", tasks_file=str(TASKS_FILE), mode="event_driven")
    await engine.run()


if __name__ == "__main__":
    asyncio.run(main())
