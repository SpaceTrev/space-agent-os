"""Telegram Channel — channel adapter for Telegram Bot API.

Provides send, notify, and long-poll listening via the Telegram Bot API.

Config (env vars):
  TELEGRAM_BOT_TOKEN    required (from @BotFather)
  TELEGRAM_CHAT_ID      default chat to send to (can be group or user ID)
"""
from __future__ import annotations

import asyncio
import logging
import os
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

TELEGRAM_API_BASE = "https://api.telegram.org"
BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
DEFAULT_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")


@dataclass
class TelegramMessage:
    """Parsed inbound Telegram message."""
    update_id: int
    message_id: int
    chat_id: int
    from_id: int | None
    from_username: str
    text: str
    date: int  # Unix timestamp
    is_bot: bool


class TelegramChannel:
    """Telegram Bot API channel adapter."""

    def __init__(
        self,
        token: str = BOT_TOKEN,
        chat_id: str = DEFAULT_CHAT_ID,
    ) -> None:
        if not token:
            raise ValueError("TELEGRAM_BOT_TOKEN not set")
        self._token = token
        self._chat_id = chat_id
        self._api_root = f"{TELEGRAM_API_BASE}/bot{token}"

    # ── Core send ─────────────────────────────────────────────────────────────

    async def send(
        self,
        text: str,
        *,
        chat_id: str | None = None,
        parse_mode: str = "Markdown",
        reply_to: int | None = None,
    ) -> dict[str, Any]:
        """Send a text message. Returns the sent message object."""
        cid = chat_id or self._chat_id
        if not cid:
            raise ValueError("chat_id required")

        payload: dict[str, Any] = {
            "chat_id": cid,
            "text": text[:4096],  # Telegram limit
            "parse_mode": parse_mode,
        }
        if reply_to:
            payload["reply_to_message_id"] = reply_to

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self._api_root}/sendMessage",
                json=payload,
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise RuntimeError(f"Telegram error: {data.get('description')}")
            msg_id = data["result"]["message_id"]
            log.info("telegram.sent", chat=cid, msg_id=msg_id)
            return data["result"]

    async def notify(
        self,
        title: str,
        body: str,
        *,
        chat_id: str | None = None,
        emoji: str = "🤖",
    ) -> dict[str, Any]:
        """Send a structured notification with title and body."""
        text = f"{emoji} *{title}*\n\n{body}"
        return await self.send(text, chat_id=chat_id)

    # ── Long polling ──────────────────────────────────────────────────────────

    async def get_updates(
        self,
        *,
        offset: int | None = None,
        timeout: int = 30,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Long-poll for updates using getUpdates."""
        params: dict[str, Any] = {"timeout": timeout, "limit": limit}
        if offset is not None:
            params["offset"] = offset

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._api_root}/getUpdates",
                params=params,
                timeout=float(timeout + 5),
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise RuntimeError(f"Telegram error: {data.get('description')}")
            return data.get("result", [])

    async def listen(
        self,
        *,
        skip_bots: bool = True,
        command_prefix: str = "/",
    ) -> AsyncIterator[TelegramMessage]:
        """Async generator yielding inbound Telegram messages via long polling."""
        offset: int | None = None
        log.info("telegram.listen_start", chat_id=self._chat_id)

        while True:
            try:
                updates = await self.get_updates(offset=offset, timeout=30)
                for update in updates:
                    offset = update["update_id"] + 1
                    msg_data = update.get("message") or update.get("channel_post")
                    if not msg_data:
                        continue
                    from_data = msg_data.get("from") or {}
                    is_bot = from_data.get("is_bot", False)
                    if skip_bots and is_bot:
                        continue
                    text = msg_data.get("text", "")
                    if not text:
                        continue
                    msg = TelegramMessage(
                        update_id=update["update_id"],
                        message_id=msg_data["message_id"],
                        chat_id=msg_data["chat"]["id"],
                        from_id=from_data.get("id"),
                        from_username=from_data.get("username", "unknown"),
                        text=text,
                        date=msg_data["date"],
                        is_bot=is_bot,
                    )
                    log.info(
                        "telegram.message",
                        from_user=msg.from_username,
                        text=text[:60],
                    )
                    yield msg
            except httpx.HTTPError as exc:
                log.error("telegram.poll_error", exc=str(exc))
                await asyncio.sleep(5.0)
            except Exception:
                log.exception("telegram.unexpected_error")
                await asyncio.sleep(10.0)
