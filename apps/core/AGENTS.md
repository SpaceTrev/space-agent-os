# Space-Claw Agent Architecture

## Overview

Space-Claw is a three-tier AI operating system. Messages arrive via WhatsApp (OpenClaw gateway), are classified by the Orchestrator, and dispatched to the appropriate automation.

```
WhatsApp / OpenClaw
        │
        ▼
  HeartbeatEngine          — polls every 30 min, receives webhook messages
        │
        ▼
  IntentRouter             — ORCHESTRATOR tier, classifies to Intent enum
        │
   ┌────┴────────────────────────────────────────┐
   ▼         ▼          ▼           ▼            ▼
DevPipeline  DraftReplies  ScheduleScan  MarketOverview  ...
   │
   └─ PlannerAgent (ARCHITECT)
   └─ ImplementerAgent (WORKER)
   └─ ReviewerAgent (ARCHITECT)
```

## Model Tier Table

| Tier         | Model                    | Provider        | Use Case                                   |
|--------------|--------------------------|-----------------|---------------------------------------------|
| ORCHESTRATOR | `llama3.3:8b`            | Ollama (local)  | Intent classification, triage, routing      |
| WORKER       | `qwen3-coder:30b-a3b`    | Ollama (local)  | Code generation, implementation, logic      |
| ARCHITECT    | `claude-sonnet-4-6`      | Anthropic API   | Planning, review, drafting, market analysis |

**Routing rules:**
- Default to Ollama — zero API cost.
- Escalate to ARCHITECT only for: planning, reviewing, drafting, market analysis.
- Heartbeat / triage always uses ORCHESTRATOR.

## Key Files

```
agents/
  heartbeat.py        Entry point. Polls TASKS.md + receives WhatsApp messages.
  orchestrator.py     Ollama connectivity check + model router.
  worker.py           Asyncio queue consumer, streams Ollama completions.
  pipeline.py         PipelineStep / Pipeline / PipelineResult primitives.
  dev_agents.py       PlannerAgent + ImplementerAgent + ReviewerAgent + DevPipeline.
  intent_router.py    Intent enum + IntentRouter.route() / .dispatch().
  automations/
    git_ops.py        get_diff, create_branch, commit_files, get_repo_context.
    code_writer.py    parse_code_blocks, write_code_blocks.
    whatsapp_notify.py  notify(message) — POST to OpenClaw gateway.
```

## Adding a New Automation

1. **Add an Intent variant** in `agents/intent_router.py`:
   ```python
   class Intent(str, Enum):
       MY_NEW_INTENT = 'MY_NEW_INTENT'
   ```

2. **Write a handler coroutine** in the same file (or import from `automations/`):
   ```python
   async def _handle_my_new_intent(message: str) -> str:
       ...
       return result_string
   ```

3. **Register it** in `IntentRouter._handlers`:
   ```python
   Intent.MY_NEW_INTENT: _handle_my_new_intent,
   ```

4. **Update the classification system prompt** to include the new intent name.

The HeartbeatEngine and WhatsApp dispatch require no changes — `IntentRouter.dispatch()` handles the rest.

## Running

```bash
# Install deps
cd apps/core && uv sync

# Start heartbeat (polls TASKS.md + handles WhatsApp)
uv run python -m agents.heartbeat

# Smoke-test pipeline imports
uv run python -c "
from agents.pipeline import Pipeline, PipelineStep, ModelTier
from agents.dev_agents import DevPipeline
from agents.intent_router import IntentRouter, Intent
from agents.automations.git_ops import get_diff
from agents.automations.code_writer import parse_code_blocks
from agents.automations.whatsapp_notify import notify
print('all imports ok')
"

# Run a dev task directly
uv run python -c "
import asyncio
from agents.dev_agents import DevPipeline
result = asyncio.run(DevPipeline().run('Add a health check endpoint to FastAPI'))
print(result.final_output[:500])
"
```

## Environment Variables

```
OLLAMA_BASE_URL        http://localhost:11434
ORCHESTRATOR_MODEL     llama3.3:8b
WORKER_MODEL           qwen3-coder:30b-a3b
ANTHROPIC_API_KEY      (required for ARCHITECT tier)
OPENCLAW_GATEWAY_URL   http://localhost:18789
OPENCLAW_URL           http://localhost:18789
OPENCLAW_TOKEN         (Bearer token)
OPENCLAW_NOTIFY_PATH   /api/notify  (override endpoint)
HEARTBEAT_INTERVAL     1800  (seconds)
LOG_LEVEL              INFO
```
