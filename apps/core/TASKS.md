# TASKS.md -- Space-Claw Active Task Queue
# Format: - [PRIORITY] Description @owner #tag
# Priorities: URGENT | HIGH | NORMAL | LOW
# Updated by: Heartbeat engine every 30 min

## URGENT

## HIGH

- [HIGH] Start heartbeat service: `python -m agents.heartbeat` @trev #infra
- [HIGH] Start worker service and wire asyncio.Queue to heartbeat engine @trev #infra
- [HIGH] Set OPENCLAW_TOKEN in .env and verify GET /api/messages returns 200 @trev #channels

## NORMAL

- [NORMAL] Pull Ollama models: `ollama pull llama3.3` and `ollama pull qwen3-coder:30b-a3b`
- [NORMAL] Copy `.env.example` to `.env` and fill in API keys
- [NORMAL] Run smoke test: `python -m agents.orchestrator`
- [NORMAL] Run smoke test: `python -m agents.worker`
- [NORMAL] Implement dispatch_whatsapp_commands command parser (!task prefix) @trev #channels
- [NORMAL] Implement notify_discord via httpx REST (replace stub) @trev #channels
- [NORMAL] Wire Gmail MCP into fetch_urgent_gmail stub @trev #channels

## LOW

- [LOW] Set up Gmail MCP credentials
- [LOW] Set up Slack MCP credentials
- [LOW] Configure Playwright timesheet automation
- [LOW] Add pytest smoke tests for heartbeat and worker
- [LOW] Add Dockerfile / compose.yml for containerised deployment

---
*Last heartbeat: never (service not started yet)*
