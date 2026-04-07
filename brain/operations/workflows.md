---
id: operations-workflows
title: Operational Workflows & Runbooks
vault: operations
domain: ops
tags:
  - ops
  - workflows
  - heartbeat
  - tasks
  - deployment
priority: high
created: 2026-04-06
updated: 2026-04-06
token_estimate: 350
---

# Operational Workflows & Runbooks

## Task Queue Management

- **Source of truth**: `apps/core/TASKS.md`
- **Heartbeat**: polls every 30 minutes, posts summary to Discord `#claw-chat`
- **Priority tags**: `[URGENT]`, `[HIGH]`, `[NORMAL]`, `[LOW]`
- **Done**: completed tasks → `TASKS_DONE.md` with timestamp

```markdown
## [HIGH] Task title
Assigned: context-agent
Due: 2026-04-07
Description: ...
```

## Heartbeat Cycle

Every 30 minutes the heartbeat engine:
1. Reads `TASKS.md`, counts by priority
2. Checks for overdue items (`[URGENT]` > 2h old)
3. Posts summary embed to Discord
4. Updates `logs/audit.jsonl`

## Deployment Runbook

**Backend (apps/core)**:
```bash
cd apps/core
uv sync
uv run python verify_ignition.py   # health check
uv run python start_discord_bot.py  # start bot
```

**Dashboard (apps/dashboard)**:
```bash
pnpm install
pnpm build
# Deploy to Railway via git push
```

**Environment checks**:
- `PRIMARY_BACKEND` — `claude_max` | `anthropic` | `ollama`
- `DISCORD_BOT_TOKEN` — required for bot
- `DISCORD_CHANNEL_ID` — heartbeat channel
- `BRAIN_ROOT` — defaults to `../../brain` from `apps/core/`

## Incident Response

1. Alert in `#claw-chat` with error summary
2. Check `logs/audit.jsonl` for last 50 entries
3. Identify failing agent / task
4. Mark task `[BLOCKED]` in TASKS.md
5. Post root cause to `#claw-chat`
6. Fix → re-run → verify → update TASKS.md

## Brain Update Protocol

After every significant task:
```bash
python -m brain extract "<task title>" --output <task_output_file>
```
Or manually: create a skill doc in `brain/skills/` following SCHEMA.md.
