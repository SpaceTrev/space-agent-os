"""Smoke tests for heartbeat engine and EventBus wiring."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

# Ensure apps/core is on path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── EventBus ────────────────────────────────────────────────────────────────

def test_eventbus_import():
    from orchestration.events import EventBus, TaskEvent
    bus = EventBus()
    assert bus is not None


@pytest.mark.asyncio
async def test_eventbus_publish_and_receive():
    """TaskEvent published to a stage is received by its subscriber."""
    from orchestration.events import EventBus, TaskEvent

    bus = EventBus()
    received: list[TaskEvent] = []

    async def handler(event: TaskEvent):
        received.append(event)

    bus.subscribe("context", handler)
    await bus.publish(TaskEvent(
        task_id="t-001",
        agent_type="context",
        status="pending",
        payload={"description": "test task"},
    ))
    await asyncio.sleep(0.05)

    assert len(received) == 1
    assert received[0].task_id == "t-001"
    assert received[0].payload["description"] == "test task"


@pytest.mark.asyncio
async def test_eventbus_no_cross_contamination():
    """Events for stage A do not reach subscribers for stage B."""
    from orchestration.events import EventBus, TaskEvent

    bus = EventBus()
    received_b: list[TaskEvent] = []

    async def handler_b(event: TaskEvent):
        received_b.append(event)

    bus.subscribe("planner", handler_b)
    await bus.publish(TaskEvent(task_id="t-002", agent_type="context", status="pending"))
    await asyncio.sleep(0.05)

    assert len(received_b) == 0


# ── PipelineManager ──────────────────────────────────────────────────────────

def test_pipeline_manager_import():
    from orchestration.pipeline import PipelineManager, PIPELINE
    assert "context" in PIPELINE
    assert "qa" in PIPELINE
    assert PIPELINE.index("qa") == len(PIPELINE) - 1


@pytest.mark.asyncio
async def test_pipeline_advances_to_next_stage():
    """A 'done' event on 'context' causes PipelineManager to emit 'pending' on 'planner'."""
    from orchestration.events import EventBus, TaskEvent
    from orchestration.pipeline import PipelineManager

    bus = EventBus()
    PipelineManager(bus)

    planner_events: list[TaskEvent] = []

    async def capture_planner(event: TaskEvent):
        planner_events.append(event)

    bus.subscribe("planner", capture_planner)

    await bus.publish(TaskEvent(
        task_id="t-003",
        agent_type="context",
        status="done",
        payload={"description": "test advance"},
    ))
    await asyncio.sleep(0.1)

    assert len(planner_events) >= 1
    assert planner_events[0].task_id == "t-003"
    assert planner_events[0].status == "pending"


@pytest.mark.asyncio
async def test_pipeline_blocked_on_failure():
    """A 'failed' event causes PipelineManager to emit a 'blocked' event."""
    from orchestration.events import EventBus, TaskEvent
    from orchestration.pipeline import PipelineManager

    bus = EventBus()
    PipelineManager(bus)

    blocked_events: list[TaskEvent] = []

    async def capture_blocked(event: TaskEvent):
        blocked_events.append(event)

    bus.subscribe("blocked", capture_blocked)

    await bus.publish(TaskEvent(
        task_id="t-004",
        agent_type="engineer",
        status="failed",
        payload={"error": "build failed"},
    ))
    await asyncio.sleep(0.1)

    assert len(blocked_events) >= 1
    assert blocked_events[0].status == "blocked"


# ── HeartbeatEngine ──────────────────────────────────────────────────────────

def test_heartbeat_parse_tasks():
    from agents.heartbeat import parse_tasks

    content = """
## URGENT

- [URGENT] Fix the critical bug @trev #backend

## HIGH

- [HIGH] Add tests @trev #infra

## NORMAL

- [NORMAL] Write docs
"""
    tasks = parse_tasks(content)
    assert len(tasks) == 3
    assert tasks[0]["priority"] == "URGENT"
    assert tasks[1]["priority"] == "HIGH"
    assert "Add tests" in tasks[1]["description"]


def test_heartbeat_timestamp_upsert():
    from agents.heartbeat import update_heartbeat_timestamp

    content = "## URGENT\n\n---\n*Last heartbeat: 2026-01-01T00:00:00Z*\n"
    updated = update_heartbeat_timestamp(content, "2026-03-27T04:00:00Z")
    assert "2026-03-27T04:00:00Z" in updated
    assert "2026-01-01" not in updated


def test_heartbeat_timestamp_insert():
    """Adds footer when none exists."""
    from agents.heartbeat import update_heartbeat_timestamp

    content = "## URGENT\n\n- [HIGH] Some task\n"
    updated = update_heartbeat_timestamp(content, "2026-03-27T04:00:00Z")
    assert "2026-03-27T04:00:00Z" in updated


@pytest.mark.asyncio
async def test_heartbeat_publishes_urgent_tasks(tmp_path):
    """HeartbeatEngine._publish_task puts a TaskEvent on the bus."""
    from orchestration.events import EventBus, TaskEvent
    from agents.heartbeat import HeartbeatEngine

    bus = EventBus()
    engine = HeartbeatEngine(bus=bus)

    context_events: list[TaskEvent] = []

    async def capture(event: TaskEvent):
        context_events.append(event)

    bus.subscribe("context", capture)

    await engine._publish_task({"priority": "HIGH", "description": "Test urgent task"})
    await asyncio.sleep(0.05)

    assert len(context_events) == 1
    assert context_events[0].agent_type == "context"
    assert context_events[0].status == "pending"
    assert context_events[0].payload["source"] == "tasks_md"


# ── role_spec routing ────────────────────────────────────────────────────────

def test_role_spec_backend_status_no_key():
    """get_backend_status returns 'none' warning when no backend is usable."""
    import os, importlib
    orig_key = os.environ.pop("ANTHROPIC_API_KEY", None)
    orig_ollama = os.environ.get("OLLAMA_ENABLED", "false")
    orig_backend = os.environ.get("PRIMARY_BACKEND", "ollama")
    os.environ["OLLAMA_ENABLED"] = "false"
    os.environ["PRIMARY_BACKEND"] = "anthropic"  # wants API key but none set
    try:
        import agents.role_spec as rs
        importlib.reload(rs)
        status = rs.get_backend_status()
        assert status["active_backend"] == "none"
        assert "warning" in status
    finally:
        if orig_key:
            os.environ["ANTHROPIC_API_KEY"] = orig_key
        os.environ["OLLAMA_ENABLED"] = orig_ollama
        os.environ["PRIMARY_BACKEND"] = orig_backend


def test_role_spec_backend_status_ollama():
    """get_backend_status returns ollama backend when PRIMARY_BACKEND=ollama."""
    import os, importlib
    orig_key = os.environ.pop("ANTHROPIC_API_KEY", None)
    orig_backend = os.environ.get("PRIMARY_BACKEND", "ollama")
    os.environ["OLLAMA_ENABLED"] = "true"
    os.environ["PRIMARY_BACKEND"] = "ollama"
    try:
        import agents.role_spec as rs
        importlib.reload(rs)
        status = rs.get_backend_status()
        assert status["active_backend"] == "ollama"
    finally:
        if orig_key:
            os.environ["ANTHROPIC_API_KEY"] = orig_key
        os.environ["OLLAMA_ENABLED"] = "false"
        os.environ["PRIMARY_BACKEND"] = orig_backend
