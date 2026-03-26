"""Discord Channel — production-grade channel adapter for Discord.

Wraps the Discord REST API via httpx (no discord.py dependency in this layer).
For bot slash commands, see agents/discord_bot.py.

This module provides:
  DiscordChannel.send()   — post a message to a channel
  DiscordChannel.notify() — send a structured embed notification
  DiscordChannel.listen() — async generator yielding inbound messages

Config (env vars):
  DISCORD_BOT_TOKEN     required
  DISCORD_CHANNEL_ID    default channel to send to
  DISCORD_GUILD_ID      server/guild ID
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

DISCORD_API_BASE = "https://discord.com/api/v10"
BOT_TOKEN: str = os.getenv("DISCORD_BOT_TOKEN", "")
DEFAULT_CHANNEL_ID: str = os.getenv("DISCORD_CHANNEL_ID", "")
GUILD_ID: str = os.getenv("DISCORD_GUILD_ID", "")

# Discord rate-limit: 5 requests per 5 seconds per channel
_RATE_LIMIT_CALLS = 5
_RATE_LIMIT_WINDOW = 5.0


@dataclass
class DiscordMessage:
    """Parsed inbound Discord message."""
    id: str
    channel_id: str
    author_id: str
    author_name: str
    content: str
    timestamp: str
    is_bot: bool


class DiscordChannel:
    """REST-based Discord channel adapter with rate limiting."""

    def __init__(
        self,
        token: str = BOT_TOKEN,
        channel_id: str = DEFAULT_CHANNEL_ID,
    ) -> None:
        if not token:
            raise ValueError("DISCORD_BOT_TOKEN not set")
        self._token = token
        self._channel_id = channel_id
        self._headers = {
            "Authorization": f"Bot {self._token}",
            "Content-Type": "application/json",
            "User-Agent": "SpaceClaw/1.0 (https://github.com/SpaceTrev/space-agent-os)",
        }
        # Simple token-bucket rate limiter
        self._bucket: list[float] = []

    # ── Rate limiting ─────────────────────────────────────────────────────────

    async def _rate_limit(self) -> None:
        """Block until we're within the Discord rate limit."""
        now = time.monotonic()
        # Remove calls outside the current window
        self._bucket = [t for t in self._bucket if now - t < _RATE_LIMIT_WINDOW]
        if len(self._bucket) >= _RATE_LIMIT_CALLS:
            oldest = min(self._bucket)
            wait = _RATE_LIMIT_WINDOW - (now - oldest) + 0.05
            log.debug("discord.rate_limit", wait_s=round(wait, 2))
            await asyncio.sleep(wait)
        self._bucket.append(time.monotonic())

    # ── Core send ─────────────────────────────────────────────────────────────

    async def send(
        self,
        content: str,
        *,
        channel_id: str | None = None,
        reply_to: str | None = None,
    ) -> dict[str, Any]:
        """Post a plain-text message. Returns the created message object."""
        cid = channel_id or self._channel_id
        if not cid:
            raise ValueError("channel_id required")

        await self._rate_limit()
        payload: dict[str, Any] = {"content": content[:2000]}  # Discord limit
        if reply_to:
            payload["message_reference"] = {"message_id": reply_to}

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{DISCORD_API_BASE}/channels/{cid}/messages",
                headers=self._headers,
                json=payload,
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            log.info("discord.sent", channel=cid, msg_id=data.get("id"))
            return data

    async def notify(
        self,
        title: str,
        description: str,
        *,
        color: int = 0x5865F2,  # Discord blurple
        channel_id: str | None = None,
        fields: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Send an embed notification."""
        cid = channel_id or self._channel_id
        if not cid:
            raise ValueError("channel_id required")

        await self._rate_limit()
        embed: dict[str, Any] = {
            "title": title[:256],
            "description": description[:4096],
            "color": color,
        }
        if fields:
            embed["fields"] = fields[:25]  # Discord max 25 fields

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{DISCORD_API_BASE}/channels/{cid}/messages",
                headers=self._headers,
                json={"embeds": [embed]},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            log.info("discord.embed_sent", channel=cid, title=title[:40])
            return data

    # ── Receive / poll ────────────────────────────────────────────────────────

    async def fetch_messages(
        self,
        *,
        channel_id: str | None = None,
        limit: int = 50,
        after: str | None = None,
    ) -> list[DiscordMessage]:
        """Fetch recent messages from a channel."""
        cid = channel_id or self._channel_id
        params: dict[str, Any] = {"limit": min(limit, 100)}
        if after:
            params["after"] = after

        await self._rate_limit()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{DISCORD_API_BASE}/channels/{cid}/messages",
                headers=self._headers,
                params=params,
                timeout=10.0,
            )
            resp.raise_for_status()
            raw: list[dict[str, Any]] = resp.json()

        return [
            DiscordMessage(
                id=m["id"],
                channel_id=cid,
                author_id=m["author"]["id"],
                author_name=m["author"]["username"],
                content=m.get("content", ""),
                timestamp=m["timestamp"],
                is_bot=m["author"].get("bot", False),
            )
            for m in raw
        ]

    async def listen(
        self,
        *,
        channel_id: str | None = None,
        poll_interval: float = 5.0,
        skip_bots: bool = True,
    ) -> AsyncIterator[DiscordMessage]:
        """Async generator that polls for new messages (long-poll fallback)."""
        last_id: str | None = None
        while True:
            try:
                msgs = await self.fetch_messages(
                    channel_id=channel_id,
                    after=last_id,
                    limit=20,
                )
                for msg in reversed(msgs):  # oldest first
                    if skip_bots and msg.is_bot:
                        continue
                    last_id = msg.id
                    yield msg
            except httpx.HTTPError as exc:
                log.error("discord.poll_error", exc=str(exc))
            await asyncio.sleep(poll_interval)
