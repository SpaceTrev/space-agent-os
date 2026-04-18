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
- [HIGH] Set Vercel production env vars @trev #infra #BLOCKING
  NEXT_PUBLIC_SUPABASE_URL=https://qsdtnnutusvkgnvnubxd.supabase.co and NEXT_PUBLIC_SUPABASE_ANON_KEY must be
  added in Vercel dashboard → Project Settings → Environment Variables → Production. No CLI token found locally.
  Without these, dashboard production runs in offline mode (Supabase not wired at build time).
  trevbdev@gmail.com user exists in Supabase and login works — just needs the vars set + redeploy.
- [HIGH] Run uv add sqlite-vec in apps/core/ (unlocks ANN vector search in VectorStore) @agent #memory
- [HIGH] Boot worker agent: `python -m agents.worker` and connect to event pipeline @space-claw #infra

## NORMAL
- [NORMAL] [DONE 2026-04-14] youtube_ingest skill shipped — apps/core/skills/youtube_ingest.py + POST /ingest/youtube API endpoint. Tested on vIX6ztULs4U. brain/skills/youtube-vix6ztuls4u.md filed. #space-scribe #skills
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
- [LOW] Extend youtube_ingest to support Obsidian brains/ vault (currently targets brain/) @agent #content
- [LOW] Add LLM auto-summarisation retry/backoff for rate-limited envs (in-session OAuth token contention) @agent #skills

---
*Last heartbeat: 2026-04-18T17:20:48Z*
## DONE (overnight 2026-04-18)
- [DONE] Merged PR #36 feat/marketplace-seed-live-status (12 FAM Core items + mission-control live Supabase)
- [DONE] Pruned 8 stale remote branches (all merged PRs cleaned up)
- [DONE] Full IK design system compliance sweep — zero gray-* violations across all TSX files
- [DONE] Dashboard build passing (zero errors, 0 TypeScript warnings)
- [DONE] FastAPI :8000, claude-mem :37777, sync daemon all running
- [DONE] Supabase user trevbdev@gmail.com confirmed + login tested (password: SpaceClaw2025!)
- [DONE] All production routes 200 OK: /, /login, /mission-control, /marketplace, /agents, /dispatch

*Last updated: 2026-04-18 — overnight sweep by Space-Claw*
