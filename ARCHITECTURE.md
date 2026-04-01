# Space-Agent-OS — Architecture

## Overview

Space-Agent-OS is a Turborepo monorepo with two main applications:

- **apps/dashboard** — Next.js 14+ frontend (Supabase auth, Stripe billing, agent status UI)
- **apps/core** — Python 3.12+ agent backend (orchestrator, heartbeat engine, Discord bot, worker agents)

Shared TypeScript types live in **packages/shared**.

---

## Core Architecture

### Event Bus

The Python backend uses an internal EventBus (not a queue broker) for agent-to-agent communication. Key event types: `TASK_DISPATCHED`, `TASK_COMPLETED`, `HEARTBEAT`, `PIPELINE_UPDATE`.

### Agent Routing

The `CentralBrain` routes incoming tasks by type:

| Route key | Agent | Typical source |
|---|---|---|
| `CHAT` | General assistant | Discord /ask, WhatsApp |
| `CODE` | Code agent | Linear issue with `agent:code` label |
| `PLAN` | Planning agent | Manual invocation |
| `RESEARCH` | Research agent | Linear issue with `agent:research` label |
| `ARCHITECT` | Architect agent | ADR / spec requests |
| `SWARM` | Parallel multi-agent | Complex tasks requiring parallelism |

### Heartbeat Engine

Polls `apps/core/TASKS.md` every 30 minutes and emits `HEARTBEAT` events. Also checks health of external dependencies (Supabase, OpenClaw proxy, Discord bot).

### Execution Layer (OpenClaw)

All LLM calls route through the OpenClaw proxy:
- **Local:** `http://localhost:3456`
- **Remote (Tailscale):** `http://100.102.161.30:3100`

OpenClaw translates OpenAI-compatible requests to Claude Max. This decouples model selection from agent code.

---

## Ground Control Integrations

Ground Control is the product layer being built on top of this platform. It adds three first-class integrations that make the agent loop autonomous end-to-end. See `brains/projects/space-agent-os/ground-control-product-spec.md` for the full spec.

### Linear Integration

Linear issues are the canonical task queue. Webhooks from Linear fire when issues are created, labelled, or transitioned. The routing label on the issue determines which agent class handles it.

- Webhook endpoint: `POST /webhooks/linear`
- Config: `LINEAR_API_KEY`, `LINEAR_WEBHOOK_SECRET`, `LINEAR_TEAM_ID`

### GitHub Integration

Pull requests are first-class events. The `GitHubConnector` (`apps/core/integrations/github_connector.py`) handles:

- `pull_request.opened` → triggers QA agent
- `pull_request.merged` → closes the related Linear ticket (parsed from branch name)
- `pull_request.closed` (unmerged) → logs + optionally updates Linear issue state

Branch naming convention required for ticket auto-close:
```
feat/{TEAM_PREFIX}-{LINEAR_ISSUE_ID}-{short-slug}
```

- Webhook endpoint: `POST /webhooks/github`
- Config: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`

### Brain-File Context Hydration

Before any agent picks up a task, Ground Control loads context from the `brains/` directory:

```
brains/
  projects/{name}/context.md    ← project state, decisions, constraints
  projects/{name}/*.md          ← specs, ADRs
  global/                       ← always-loaded cross-project context
```

This replaces manual context-pasting. Agents receive structured context automatically.

---

## Deployment

### Local Development

```bash
# All services
pnpm dev

# Python backend only
cd apps/core && uv run python agents/heartbeat.py

# Discord bot
cd apps/core && uv run python start_discord_bot.py
```

### Production Target: Railway

Persistent Node.js process + Railway managed Postgres. Vercel is not viable — Paperclip's event-driven architecture requires a long-running process.

**Pending:** Railway project credentials from Trev before first deploy.

See `brains/projects/space-agent-os/context.md` for deployment context and blockers.

---

## TODO

- [ ] Wire `POST /webhooks/github` endpoint to `GitHubConnector`
- [ ] Wire `POST /webhooks/linear` endpoint to task router
- [ ] Create GitHub App and configure webhook secrets
- [ ] Configure Railway project (pending credentials from Trev)
- [ ] Add Railway `Procfile` or `railway.toml` for process definition
