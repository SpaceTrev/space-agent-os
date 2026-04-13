# apps/core/sync/push_state.py
"""Periodically push local system state to Supabase."""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from .config import supabase

logger = logging.getLogger("sync.push_state")

LOCAL_API = "http://localhost:8000"
PUSH_INTERVAL = 10  # seconds


async def _fetch_json(client: httpx.AsyncClient, path: str) -> dict | list | None:
    """GET a local API endpoint; return parsed JSON or None on failure."""
    try:
        resp = await client.get(f"{LOCAL_API}{path}", timeout=5.0)
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Failed to fetch %s: %s", path, exc)
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _push_once() -> None:
    """Fetch local state and upsert into Supabase."""
    async with httpx.AsyncClient() as client:
        health = await _fetch_json(client, "/health")
        agents = await _fetch_json(client, "/agents")
        models = await _fetch_json(client, "/models")

    now = _now_iso()

    # ── system_state (single row) ──────────────────────────────────
    if health is not None:
        payload = {"id": "singleton", "health": health, "updated_at": now}
    else:
        payload = {
            "id": "singleton",
            "health": {"status": "offline"},
            "updated_at": now,
        }

    supabase.table("system_state").upsert(payload).execute()
    logger.info("Pushed system_state: %s", payload["health"].get("status", "ok"))

    # ── agent_status (one row per agent) ───────────────────────────
    if agents is not None:
        agent_list = agents if isinstance(agents, list) else agents.get("agents", [])
        for agent in agent_list:
            row = {
                "name": agent.get("name", "unknown"),
                "role": agent.get("role", ""),
                "tier": agent.get("tier", ""),
                "module": agent.get("module", ""),
                "status": agent.get("status", "unknown"),
                "updated_at": now,
            }
            supabase.table("agent_status").upsert(row).execute()
        logger.info("Pushed %d agent rows", len(agent_list))
    else:
        logger.warning("Agents endpoint unavailable – skipping agent_status push")

    # ── model_status (one row per model) ───────────────────────────
    if models is not None:
        model_list = models if isinstance(models, list) else models.get("models", [])
        for model in model_list:
            row = {
                "name": model if isinstance(model, str) else model.get("name", "unknown"),
                "available": True if isinstance(model, str) else model.get("available", False),
                "updated_at": now,
            }
            supabase.table("model_status").upsert(row).execute()
        logger.info("Pushed %d model rows", len(model_list))
    else:
        logger.warning("Models endpoint unavailable – skipping model_status push")


async def push_state_loop() -> None:
    """Run the push loop forever."""
    logger.info("push_state loop started (interval=%ds)", PUSH_INTERVAL)
    while True:
        try:
            await _push_once()
        except Exception:
            logger.exception("Unhandled error in push_state")
        await asyncio.sleep(PUSH_INTERVAL)
