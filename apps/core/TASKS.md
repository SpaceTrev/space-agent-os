# TASKS.md -- Space-Claw Active Task Queue
# Format: - [PRIORITY] Description @owner #tag
# Priorities: URGENT | HIGH | NORMAL | LOW
# Updated by: Heartbeat engine every 30 min

## URGENT
- [URGENT] Wire discord_bot /ask -> CentralBrain.handle() @agent #discord #orchestration
- [URGENT] Wire heartbeat.py dispatch -> CentralBrain.handle() @agent #orchestration

## HIGH
- [HIGH] Wire Timescale DB into FastAPI backend for persistent storage @agent #infra #database
  Set TIMESCALE_URL (or DATABASE_URL) env var in Railway. Use asyncpg to write agent runs, task history,
  and token usage metrics to Timescale hypertables. The dep (asyncpg) is already in pyproject.toml.
  Schema: agent_runs(id, goal, route, agents_used, elapsed_s, error, created_at),
          task_history(id, priority, description, status, source, created_at),
          model_usage(model, provider, tokens_in, tokens_out, latency_s, created_at).
- [HIGH] Wire Discord /ask command end-to-end smoke test @trev #discord
  Bot invite + ANTHROPIC_API_KEY needed. Once set: test /ask, /status, /swarm via real Discord slash commands.
- [HIGH] Add Supabase env vars to apps/dashboard/.env.local @trev #infra
  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY needed for dashboard DB. health_check reports not_configured.
- [HIGH] Run uv add sqlite-vec in apps/core/ (unlocks ANN vector search in VectorStore) @agent #memory
- [HIGH] Boot worker agent: `python -m agents.worker` and connect to event pipeline @space-claw #infra

## NORMAL
- [NORMAL] Add gemma4:31b as BRAIN_MODEL tier in role_spec.py + config/models.yml @agent #models
- [NORMAL] Write docs/ directory: WORKFLOWS.md, AGENT_ROSTER.md, ROLESPEC.md, DISCORD.md, ARCHITECTURE.md, DEVELOPMENT.md @agent #docs
- [NORMAL] Implement SkillExtractor: read audit.jsonl, write distilled skills to apps/core/skills/ after each run @agent #skills
- [NORMAL] Add all new env vars to apps/core/.env.example @agent #infra
- [NORMAL] Implement dispatch_whatsapp_commands command parser (!task prefix) @trev #channels
- [NORMAL] Wire Gmail MCP into fetch_urgent_gmail stub @trev #channels
- [NORMAL] Build Context Agent — reads CLAUDE.md + TASKS.md, surfaces blockers, owns project memory @space-claw #agents

## LOW
- [LOW] Set up Gmail MCP credentials
- [LOW] Set up Slack MCP credentials
- [LOW] Add pytest smoke tests for heartbeat, worker, and MCP server tools
- [LOW] Configure Playwright timesheet automation
- [LOW] Add Dockerfile / compose.yml for containerised deployment
- [LOW] Design space-scribe -> brains/research/ ingestion pipeline @agent #content

---
*Last heartbeat: 2026-04-09T16:01:16Z*
*Last updated: 2026-04-07 — merged task backlog, boot system in progress*
