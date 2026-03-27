# TASKS.md -- Space-Claw Active Task Queue
# Format: - [PRIORITY] Description @owner #tag
# Priorities: URGENT | HIGH | NORMAL | LOW
# Updated by: Heartbeat engine every 30 min

## URGENT

## HIGH
- [HIGH] Wire Discord bot — heartbeat to listen for !task commands and route to pipeline @space-claw #channels
- [HIGH] Boot worker agent: `python -m agents.worker` and connect to event pipeline @space-claw #infra
- [HIGH] Build agent monitoring view in apps/dashboard — show live task queue, agent status, system health @space-claw #dashboard

## NORMAL
- [NORMAL] Run smoke tests: `python -m agents.orchestrator` and `python -m agents.worker`
- [NORMAL] Implement notify_discord via REST (replace stub in heartbeat) @space-claw #channels
- [NORMAL] Wire Gmail MCP into fetch_urgent_gmail stub @space-claw #channels
- [NORMAL] Build Context Agent — reads CLAUDE.md + TASKS.md, surfaces blockers, owns project memory @space-claw #agents
- [NORMAL] Set up n8n for workflow automation glue (GitHub webhooks → agent triggers) @space-claw #infra
- [NORMAL] Build consulting business first asset — client-facing one-pager for Mexico market @space-claw #business

## LOW
- [LOW] Set up Gmail MCP credentials
- [LOW] Set up Slack MCP credentials
- [LOW] Add pytest smoke tests for heartbeat, worker, and MCP server tools
- [LOW] Containerize: update Dockerfile + compose.yml for production deployment

---
*Last updated: 2026-03-26 — legacy setup tasks done, forward-looking tasks loaded*
