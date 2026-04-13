# apps/core/sync/poll_commands.py
"""Poll Supabase for pending commands and dispatch them to CentralBrain."""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from .config import supabase

logger = logging.getLogger("sync.poll_commands")

POLL_INTERVAL = 2  # seconds
CENTRAL_BRAIN_URL = "http://localhost:8000/command"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _dispatch(command: str, payload: dict) -> dict:
    """Forward a command to the local CentralBrain endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            CENTRAL_BRAIN_URL,
            json={"command": command, "payload": payload},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()


async def _process_command(row: dict) -> None:
    """Mark a command as running, dispatch it, then mark completed or failed."""
    cmd_id = row["id"]
    command = row["command"]
    payload = row.get("payload") or {}

    # Set status → running
    supabase.table("commands").update(
        {"status": "running", "updated_at": _now_iso()}
    ).eq("id", cmd_id).execute()

    logger.info("Dispatching command %s: %s", cmd_id, command)

    try:
        result = await _dispatch(command, payload)
        supabase.table("commands").update(
            {"status": "completed", "result": result, "updated_at": _now_iso()}
        ).eq("id", cmd_id).execute()
        logger.info("Command %s completed", cmd_id)

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        supabase.table("commands").update(
            {
                "status": "failed",
                "result": {"error": error_msg},
                "updated_at": _now_iso(),
            }
        ).eq("id", cmd_id).execute()
        logger.error("Command %s failed: %s", cmd_id, error_msg)


async def poll_commands_loop() -> None:
    """Poll for pending commands forever."""
    logger.info("poll_commands loop started (interval=%ds)", POLL_INTERVAL)
    while True:
        try:
            resp = (
                supabase.table("commands")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .execute()
            )
            rows = resp.data or []

            if rows:
                logger.info("Found %d pending command(s)", len(rows))

            for row in rows:
                await _process_command(row)

        except Exception:
            logger.exception("Unhandled error in poll_commands")

        await asyncio.sleep(POLL_INTERVAL)
