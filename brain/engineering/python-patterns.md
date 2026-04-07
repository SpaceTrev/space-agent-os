---
id: engineering-python-patterns
title: Python Patterns & Conventions
vault: engineering
domain: python
tags:
  - python
  - async
  - patterns
  - structlog
  - pydantic
  - httpx
priority: high
created: 2026-04-06
updated: 2026-04-06
token_estimate: 500
---

# Python Patterns & Conventions

## Async-First

All I/O is async. No `requests`, no `time.sleep`, no blocking file I/O in hot paths.

```python
async def fetch_data(url: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()
```

## Structured Logging

```python
import structlog
log = structlog.get_logger()

log.info("task.started", agent="context", task_preview=task[:80])
log.error("task.failed", agent="context", error=str(exc))
```

Never use `print()` or `logging.info()` directly. Always `structlog`.

## Type Hints Everywhere

```python
from __future__ import annotations  # top of every file
from dataclasses import dataclass, field
from typing import Any

@dataclass
class AgentResult:
    agent_name: str
    output: str
    model_used: str
    elapsed_s: float
    error: str | None = None
```

## Error Handling Pattern

```python
error: str | None = None
output = ""
try:
    output = await call_llm(spec, task, context)
except Exception as exc:
    error = str(exc)
    log.error("agent.error", agent=spec.name, error=error)
```

Never swallow exceptions silently. Always log, always surface.

## Config via Pydantic Settings

```python
from pydantic_settings import BaseSettings

class BrainSettings(BaseSettings):
    brain_root: Path = Path(__file__).parent.parent.parent / "brain"
    token_budget: int = 20_000
    chars_per_token: int = 4

    class Config:
        env_prefix = "BRAIN_"
```

## Path Resolution Pattern

```python
REPO_ROOT = Path(__file__).parent.parent.parent  # reliable, not os.getcwd()
BRAIN_ROOT = REPO_ROOT / "brain"
```

## Dataclass Over Dict

Use `@dataclass` for structured data. Use `dict` only for truly dynamic shapes.

## Audit Logging

```python
import json, time
from pathlib import Path

AUDIT_LOG = Path(__file__).parent.parent / "logs" / "audit.jsonl"

def audit(agent: str, action: str, target: str, **extra: Any) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "agent": agent, "action": action, "target": target, **extra}
    with AUDIT_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
```
