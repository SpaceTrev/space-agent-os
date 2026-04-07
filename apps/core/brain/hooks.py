"""
hooks.py — Workflow hooks for the post-task knowledge loop.

Hooks are called by BaseAgent.run() and TeamOrchestrator after a task
completes. They are fire-and-forget: failures are logged but never raise.

Available hooks:
    after_task(task, result) — runs skill extraction + audit logging
    skill_extract(task, output) — standalone extraction (callable directly)

Usage:
    from brain.hooks import after_task

    # In BaseAgent.run():
    result = AgentResult(...)
    asyncio.create_task(after_task(task, result))   # non-blocking
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import structlog

log = structlog.get_logger()

# Audit log path — same as the rest of the system
_AUDIT_LOG: Path = Path(__file__).parent.parent / "logs" / "audit.jsonl"


# ─── Public hooks ─────────────────────────────────────────────────────────────


async def after_task(
    task: str,
    result: "AgentResult",  # type: ignore[name-defined]  # noqa: F821
    brain_root: Path | None = None,
) -> None:
    """
    Post-task hook: audit log + skill extraction.

    This is the main hook to wire into every agent completion.
    It is safe to fire-and-forget with asyncio.create_task().

    Args:
        task:       original task string
        result:     AgentResult from the agent
        brain_root: optional override for brain vault path
    """
    await asyncio.gather(
        _audit_task(task, result),
        _maybe_extract(task, result, brain_root),
        return_exceptions=True,
    )


async def skill_extract(
    task: str,
    output: str,
    brain_root: Path | None = None,
) -> "ExtractionResult":  # type: ignore[name-defined]  # noqa: F821
    """
    Standalone skill extraction — call directly when you want to extract
    knowledge without going through the full after_task hook.

    Args:
        task:  task description
        output: task output / result text
        brain_root: optional brain vault path override

    Returns:
        ExtractionResult (from brain.extractor)
    """
    from brain.extractor import extract_from_task
    return await extract_from_task(task, output, brain_root)


# ─── Internal ─────────────────────────────────────────────────────────────────


async def _audit_task(task: str, result: "AgentResult") -> None:  # type: ignore[name-defined]
    """Write a task completion entry to audit.jsonl."""
    try:
        _AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event": "task.completed",
            "agent": result.agent_name,
            "model": result.model_used,
            "elapsed_s": result.elapsed_s,
            "success": result.success,
            "error": result.error,
            "task_preview": task[:120],
            "output_chars": len(result.output),
        }
        with _AUDIT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        log.debug("brain.hooks.audited", agent=result.agent_name)
    except Exception as exc:
        log.warning("brain.hooks.audit_error", error=str(exc))


async def _maybe_extract(
    task: str,
    result: "AgentResult",  # type: ignore[name-defined]
    brain_root: Path | None,
) -> None:
    """Run skill extraction if the task succeeded and output is substantial."""
    if not result.success:
        log.debug("brain.hooks.skip_extract_failed", agent=result.agent_name)
        return

    if len(result.output) < 100:
        log.debug("brain.hooks.skip_extract_too_short", agent=result.agent_name)
        return

    try:
        from brain.extractor import extract_from_task
        extraction = await extract_from_task(task, result.output, brain_root)
        if extraction.extracted and extraction.skill:
            log.info(
                "brain.hooks.skill_extracted",
                skill_id=extraction.skill.id,
                agent=result.agent_name,
            )
    except Exception as exc:
        log.warning("brain.hooks.extract_error", error=str(exc))


# ─── Synchronous helper for non-async callers ─────────────────────────────────


def schedule_after_task(
    task: str,
    result: "AgentResult",  # type: ignore[name-defined]
    brain_root: Path | None = None,
) -> None:
    """
    Fire-and-forget after_task from a synchronous context.

    Uses the running event loop if available; otherwise creates a new task.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(after_task(task, result, brain_root))
    except RuntimeError:
        # No running loop (e.g. in tests or CLI) — run synchronously
        asyncio.run(after_task(task, result, brain_root))
