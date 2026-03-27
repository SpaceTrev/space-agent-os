"""Space-Claw Heartbeat — Discord gateway for pipeline injection.

The 30-minute polling loop is gone. The heartbeat now runs a Discord bot
that listens for human commands and injects tasks directly into the
event-driven pipeline via PipelineManager.inject().

Human commands (in the configured channel):
  !task <description>   — inject a new pipeline run
  !status               — report pipeline readiness

Environment vars:
  DISCORD_BOT_TOKEN     Discord bot token (required for bot to start)
  DISCORD_CHANNEL_ID    Channel ID to listen in
  LOG_LEVEL             structlog level (default INFO)
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import uuid
from typing import Any

import httpx
import structlog

from orchestration import EventBus, PipelineManager

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

DISCORD_BOT_TOKEN: str = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_CHANNEL_ID: str = os.getenv("DISCORD_CHANNEL_ID", "")
DISCORD_API = "https://discord.com/api/v10"


# ---------------------------------------------------------------------------
# Discord REST helpers (no library dependency)
# ---------------------------------------------------------------------------

async def _post_message(client: httpx.AsyncClient, channel_id: str, content: str) -> None:
    if not DISCORD_BOT_TOKEN or not channel_id:
        return
    try:
        await client.post(
            f"{DISCORD_API}/channels/{channel_id}/messages",
            headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"},
            json={"content": content},
            timeout=10.0,
        )
    except Exception as exc:
        log.warning("discord.post_failed", error=str(exc))


async def _get_gateway_url(client: httpx.AsyncClient) -> str:
    resp = await client.get(
        f"{DISCORD_API}/gateway/bot",
        headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"},
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()["url"]


# ---------------------------------------------------------------------------
# Gateway WebSocket loop
# ---------------------------------------------------------------------------

async def _gateway_loop(
    pipeline: PipelineManager,
    stop: asyncio.Event,
    client: httpx.AsyncClient,
) -> None:
    """Connect to Discord Gateway, handle HELLO/heartbeat, dispatch MESSAGE_CREATE."""
    import json

    gateway_url = await _get_gateway_url(client)
    ws_url = f"{gateway_url}/?v=10&encoding=json"

    log.info("discord.gateway_connecting", url=ws_url)

    # httpx doesn't support WebSocket — use asyncio low-level websockets if available,
    # fall back to a long-poll stub that just keeps the process alive.
    try:
        import websockets  # type: ignore

        async with websockets.connect(ws_url) as ws:
            heartbeat_interval: float = 41.25  # seconds, overwritten by HELLO
            sequence: int | None = None
            hb_task: asyncio.Task[None] | None = None

            async def _send_heartbeat() -> None:
                while not stop.is_set():
                    await ws.send(json.dumps({"op": 1, "d": sequence}))
                    log.debug("discord.heartbeat_sent")
                    await asyncio.sleep(heartbeat_interval)

            async for raw in ws:
                if stop.is_set():
                    break
                msg: dict[str, Any] = json.loads(raw)
                op: int = msg.get("op", -1)
                data: Any = msg.get("d")

                if op == 10:  # HELLO
                    heartbeat_interval = data["heartbeat_interval"] / 1000.0
                    hb_task = asyncio.ensure_future(_send_heartbeat())
                    # IDENTIFY
                    await ws.send(json.dumps({
                        "op": 2,
                        "d": {
                            "token": DISCORD_BOT_TOKEN,
                            "intents": 1 << 9,  # GUILD_MESSAGES
                            "properties": {"os": "linux", "browser": "space-claw", "device": "space-claw"},
                        },
                    }))

                elif op == 0:  # DISPATCH
                    sequence = msg.get("s")
                    t: str = msg.get("t", "")
                    if t == "MESSAGE_CREATE" and isinstance(data, dict):
                        await _handle_message(data, pipeline, client)

            if hb_task:
                hb_task.cancel()

    except ImportError:
        log.warning(
            "discord.websockets_unavailable",
            reason="websockets package not installed — bot running in stub mode (process stays alive)",
        )
        await stop.wait()


async def _handle_message(
    msg: dict[str, Any],
    pipeline: PipelineManager,
    client: httpx.AsyncClient,
) -> None:
    channel_id: str = msg.get("channel_id", "")
    if DISCORD_CHANNEL_ID and channel_id != DISCORD_CHANNEL_ID:
        return

    content: str = msg.get("content", "").strip()
    author: str = msg.get("author", {}).get("username", "unknown")

    if content.startswith("!task "):
        description = content[len("!task "):].strip()
        if not description:
            return
        task_id = str(uuid.uuid4())[:8]
        task = {"id": task_id, "description": description, "source": "discord", "author": author}
        log.info("discord.task_injected", task_id=task_id, description=description[:80])
        await pipeline.inject(task)
        await _post_message(client, channel_id, f"Pipeline started `{task_id}`: {description[:80]}")

    elif content == "!status":
        await _post_message(client, channel_id, "Space-Claw online. Pipeline ready.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    if not DISCORD_BOT_TOKEN:
        log.warning("heartbeat.no_discord_token", reason="DISCORD_BOT_TOKEN not set — running idle")

    bus = EventBus()
    pipeline = PipelineManager(bus)
    stop = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    log.info("heartbeat.started", mode="event_driven")

    async with httpx.AsyncClient() as client:
        if DISCORD_BOT_TOKEN:
            await _gateway_loop(pipeline, stop, client)
        else:
            await stop.wait()

    log.info("heartbeat.stopped")


if __name__ == "__main__":
    asyncio.run(main())
