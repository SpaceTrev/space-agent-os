# TASKS.md -- Space-Claw Active Task Queue
# Format: - [PRIORITY] Description @owner #tag
# Priorities: URGENT | HIGH | NORMAL | LOW
# Updated by: Heartbeat engine every 30 min

## URGENT

## HIGH


- [HIGH] Wire Discord /ask command end-to-end smoke test @trev #discord
  Bot invite + ANTHROPIC_API_KEY needed. Once set: test /ask, /status, /swarm via real Discord slash commands.
- [HIGH] Add Supabase env vars to apps/dashboard/.env.local @trev #infra
  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY needed for dashboard DB. health_check reports not_configured.
## NORMAL


- [NORMAL] Implement dispatch_whatsapp_commands command parser (!task prefix) @trev #channels
- [NORMAL] Wire Gmail MCP into fetch_urgent_gmail stub @trev #channels

## LOW

- [LOW] Set up Gmail MCP credentials
- [LOW] Set up Slack MCP credentials
- [LOW] Configure Playwright timesheet automation
- [LOW] Add Dockerfile / compose.yml for containerised deployment

---
*Last heartbeat: 2026-03-27T06:00:25Z*
