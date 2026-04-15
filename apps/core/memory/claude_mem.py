"""claude-mem HTTP client — thin async wrapper around the local claude-mem worker.

The worker runs at http://localhost:37777 (auto-started via launchd).

Public API:
    save_memory(text, title?, project?)  →  dict | None
    search(query, project?, limit?)      →  list[dict]

Both functions are fire-and-forget safe: if the worker is unreachable they log
a warning and return empty/None — they never raise into the caller.
"""
from __future__ import annotations

import logging

import httpx

log = logging.getLogger("memory.claude_mem")

CLAUDE_MEM_BASE_URL: str = "http://localhost:37777"
_TIMEOUT = httpx.Timeout(5.0, connect=2.0)


async def save_memory(
    text: str,
    title: str | None = None,
    project: str = "fam-dispatch",
) -> dict | None:
    """Persist an observation to claude-mem.

    POST /api/memory/save
    Body: { text, title?, project? }

    Returns the parsed response body, or None on any error.
    """
    payload: dict = {"text": text, "project": project}
    if title:
        payload["title"] = title

    try:
        async with httpx.AsyncClient(base_url=CLAUDE_MEM_BASE_URL, timeout=_TIMEOUT) as client:
            resp = await client.post("/api/memory/save", json=payload)
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        log.warning("claude_mem.save_failed project=%s error=%s", project, exc)
        return None


async def search(
    query: str,
    project: str = "fam-dispatch",
    limit: int = 5,
) -> list[dict]:
    """Search claude-mem for observations matching *query*.

    GET /api/search?query=<q>&projects=<project>&limit=<n>

    The worker returns an MCP-style envelope:
        {"content": [{"type": "text", "text": "<markdown table>"}]}
    This function normalises that into a list[dict] so callers stay simple.
    Returns a (possibly empty) list, never raises.
    """
    params = {"query": query, "projects": project, "limit": limit}

    try:
        async with httpx.AsyncClient(base_url=CLAUDE_MEM_BASE_URL, timeout=_TIMEOUT) as client:
            resp = await client.get("/api/search", params=params)
            resp.raise_for_status()
            data = resp.json()

            # Bare list — already structured
            if isinstance(data, list):
                return data

            # Standard keys from hypothetical future JSON API
            for key in ("results", "observations", "items"):
                if data.get(key):
                    return data[key]

            # MCP envelope: {"content": [{"type": "text", "text": "..."}]}
            content = data.get("content")
            if content and isinstance(content, list):
                text_parts = [
                    c["text"] for c in content
                    if isinstance(c, dict) and c.get("type") == "text" and c.get("text")
                ]
                if text_parts:
                    return [{"text": "\n".join(text_parts), "title": f"search:{query}"}]

            return []
    except Exception as exc:
        log.warning("claude_mem.search_failed query=%r project=%s error=%s", query, project, exc)
        return []
