"""conversation.py — Persistent conversation memory for Discord channels.

Stores message history in a local JSONL file per channel.
Injects recent history into every Claude call so the bot feels continuous.

File location: apps/core/memory/conversations/<channel_id>.jsonl
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

MEMORY_DIR = Path(__file__).parent / "conversations"
MAX_HISTORY = int(os.getenv("DISCORD_MEMORY_TURNS", "20"))  # messages to inject


def _channel_file(channel_id: int | str) -> Path:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    return MEMORY_DIR / f"{channel_id}.jsonl"


def append_message(channel_id: int | str, role: str, content: str, author: str = "") -> None:
    """Append a message to the channel's conversation log."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "role": role,          # "user" | "assistant"
        "author": author,
        "content": content,
    }
    with _channel_file(channel_id).open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def get_history(channel_id: int | str, max_turns: int = MAX_HISTORY) -> list[dict[str, str]]:
    """Return recent messages as OpenAI-format message list."""
    path = _channel_file(channel_id)
    if not path.exists():
        return []

    lines = path.read_text(encoding="utf-8").splitlines()
    recent = lines[-max_turns * 2:]  # each turn = user + assistant

    messages: list[dict[str, str]] = []
    for line in recent:
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            messages.append({
                "role": entry["role"],
                "content": entry["content"],
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return messages


def build_context_string(channel_id: int | str, max_turns: int = MAX_HISTORY) -> str:
    """Return recent history as a readable context block for injection into prompts."""
    history = get_history(channel_id, max_turns)
    if not history:
        return ""
    lines = []
    for msg in history:
        prefix = "Trev" if msg["role"] == "user" else "Space-Claw"
        lines.append(f"{prefix}: {msg['content'][:500]}")
    return "\n".join(lines)


def get_stats(channel_id: int | str) -> dict[str, Any]:
    path = _channel_file(channel_id)
    if not path.exists():
        return {"messages": 0, "file": str(path)}
    lines = [l for l in path.read_text().splitlines() if l.strip()]
    return {"messages": len(lines), "file": str(path)}
