"""Space-Claw Discord outbound notifier.

Sends a message or embed to a Discord channel via the bot REST API.
Used by heartbeat, orchestrator, and other services to push notifications
without spinning up a full discord.py client.

Environment vars:
  DISCORD_BOT_TOKEN   Discord bot token (required)
  DISCORD_CHANNEL_ID  Default channel to post to (integer)
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

DISCORD_API = "https://discord.com/api/v10"
BOT_TOKEN: str = os.getenv("DISCORD_BOT_TOKEN", "")
DEFAULT_CHANNEL_ID: int = int(os.getenv("DISCORD_CHANNEL_ID", "0"))


async def notify(
    message: str,
    *,
    channel_id: int | None = None,
    embed: dict[str, Any] | None = None,
) -> bool:
    """Post a plain message (or embed) to a Discord channel.

    Returns True on success, False on failure (non-raising).
    """
    cid = channel_id or DEFAULT_CHANNEL_ID
    if not cid:
        log.warning("discord_notify.no_channel", msg="DISCORD_CHANNEL_ID not set")
        return False
    if not BOT_TOKEN:
        log.warning("discord_notify.no_token", msg="DISCORD_BOT_TOKEN not set")
        return False

    headers = {
        "Authorization": f"Bot {BOT_TOKEN}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {}
    if message:
        payload["content"] = message[:2000]  # Discord limit
    if embed:
        payload["embeds"] = [embed]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{DISCORD_API}/channels/{cid}/messages",
                headers=headers,
                json=payload,
                timeout=10.0,
            )
            if resp.status_code in (200, 201):
                log.info("discord_notify.sent", channel_id=cid, chars=len(message))
                return True
            else:
                log.error(
                    "discord_notify.failed",
                    status=resp.status_code,
                    body=resp.text[:200],
                )
                return False
    except Exception as exc:
        log.error("discord_notify.error", error=str(exc))
        return False


def notify_sync(
    message: str,
    *,
    channel_id: int | None = None,
) -> bool:
    """Synchronous wrapper for notify() — use from non-async contexts."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, notify(message, channel_id=channel_id))
                return future.result(timeout=15)
        return loop.run_until_complete(notify(message, channel_id=channel_id))
    except Exception as exc:
        log.error("discord_notify_sync.error", error=str(exc))
        return False
