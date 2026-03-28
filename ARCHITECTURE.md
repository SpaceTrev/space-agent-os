# Space-Agent-OS — System Architecture

> **This is the company brain document.** It is loaded into every agent session as always-in-context reference. Keep it current. Every architectural decision that affects how agents operate must be reflected here.

---

## Vision

A self-improving autonomous business operating system.

Agents don't just execute tasks — they get better at executing tasks over time. The system compounds in accuracy because every completed task updates the brain, the skill library, and the dependency map between departments.

**The moat is not the agents. The moat is the brain + skills.**

First run: slow and rough. 100th run: near-autonomous. The gap between this system and a competitor compounds every day we run it.

---

## Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4 — Execution                                        │
│  Agents = Infrastructure + Brain(s) + Skills + MCPs        │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — Skill Library (Self-Improving)                   │
│  Distilled runs → tagged, versioned, domain-scoped skills   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Brain Layer (Domain-Specific File Systems)       │
│  Company brain → Department brains → Task brains            │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — Infrastructure                                   │
│  OpenClaw · Paperclip · MCPs · Model routing                │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Infrastructure

### OpenClaw
- Agent runtime and session manager
- Handles Discord and WhatsApp channel routing
- Exec approval gateway — all destructive/high-stakes actions route through `#claw-chat`
- Gateway: `localhost:18789`, Tailscale: `100.102.161.30:18789`
- Agent identity: `space-claw` (model: `anthropic/claude-sonnet-4-6`)

### Paperclip
- Company orchestration layer: org charts, budgets, goal alignment, heartbeats, ticket tracking
- Repo: `SpaceTrev/space-paperclip` (fork of `paperclipai/paperclip`)
- Deployed: `space-paperclip.vercel.app`, local: `localhost:3100`, Tailscale: `100.102.161.30:3100`
- Controls space-claw via the OpenClaw gateway

### MCPs (Tool Integrations)
MCPs are scoped per domain — agents only load the MCPs relevant to their work.

| Domain | MCPs |
|--------|------|
| Engineering | GitHub, Linear, filesystem, agent_mcp (Testing) |
| Marketing | Gmail, Calendar, Figma, social schedulers |
| Sales | Gmail, Calendar, CRM |
| Ops | Gmail, Calendar, Linear, Notion |
| All agents | Memory (MEMORY.md), Discord |

### Model Routing

| Role | Model | Provider | Use Case |
|------|-------|----------|----------|
| Primary | Claude Sonnet 4.6 | OpenClaw (Claude Max) | All tasks — reasoning, code, planning, orchestration |
| Secondary | Gemini 2.0 Flash | Google API | Parallel runs, very long context (>100k tokens) |
| Local (optional) | Qwen3-Coder 30B | Ollama | Offline, cost-sensitive batch, privacy-sensitive |

**Routing rules:**
- Default: Claude Max via OpenClaw for all tasks
- Gemini: parallel runs or context >100k tokens
- Ollama: only when `OLLAMA_ENABLED=true` or `/local` invocation
- Model config lives in `apps/core/config/models.yml`

### Key Infrastructure Addresses
- **Exec approvals**: Discord `#claw-chat` (channel `1484793801531719803`)
- **Primary comms**: Discord `#claw-chat`
- **Memory storage**: `~/.openclaw/agents/main/` + repo `MEMORY.md` files

---

## Layer 2 — Brain Layer

The brain is **not a vector database**. It is a well-organized file system injected as always-in-context reference. Structure and freshness matter more than embeddings.

### Three Levels of Brain

```
Company Brain (always loaded)
├── Mission, ICP, product context, team, business model
├── This file (ARCHITECTURE.md)
└── CLAUDE.md

Department Brain (loaded per domain)
├── marketing/brain/  — strategy, personas, channel playbooks
├── sales/brain/      — playbook, objection handling, pricing
├── engineering/brain/— standards, patterns, runbooks
└── ops/brain/        — processes, vendor contacts, budgets

Task/Project Brain (loaded per task)
├── client history
├── current state + blockers
├── dependencies on other departments
└── relevant prior task runs
```

### Space Scribe (`space-scribe/`)
The ingestion engine that feeds the domain brains.

- Transcribes YouTube videos, audio files, and documents into structured knowledge files
- MCP-integrated — agents can query it directly mid-task
- Output feeds into department brains as always-available reference
- Structured output format: `{source, date, summary, key_points, domain_tags, action_items}`

### Memory Pattern (per OpenClaw)
OpenClaw already implements the brain pattern with:
- `MEMORY.md` — index of all memory files
- `AGENTS.md` — agent roster and capability map
- `USER.md` — user preferences and working style

This architecture extends that pattern to every domain at every level of the org.

---

## Layer 3 — Skill Library (Self-Improving)

### How It Works

1. Agent completes a task
2. Post-task hook fires automatically → `apps/core/hooks/skill_extraction.py`
3. Hook distills the run into a tagged skill file: domain, task type, quality score, version, reuse instructions
4. Skills are stored in `apps/core/skills/`
5. On next task, matching skills are auto-loaded for the agent working in the same domain

### Skill Schema

```yaml
skill_id: string
domain: engineering | marketing | sales | ops | cross-domain
task_type: string           # e.g. "pr-review", "cold-outreach", "deploy-service"
quality_score: 0.0–1.0      # updated on each reuse
version: semver
model: string               # model that produced this skill
created_at: ISO8601
last_used: ISO8601
description: string
steps: list[string]
pitfalls: list[string]
example_inputs: list
example_outputs: list
```

### Cross-Domain Handoff Skills
The highest-value skills in the library. They encode exactly how to pass work from one department's agent to another — what context to include, what format to use, which fields are required for the receiving agent to operate without asking questions.

**Priority cross-domain skills to build:**
- `sales→engineering` — converting closed deals into delivery specs
- `engineering→marketing` — converting release notes into launch copy
- `marketing→sales` — converting content engagement into qualified lead context
- `planning→architect` — converting business initiatives into technical specs

### Skill Loading Rules
- Skills load automatically by domain match
- Quality score threshold for auto-load: ≥0.7
- Skills below threshold are available but not auto-loaded
- Agents must update quality score on reuse (up or down) via `apps/core/hooks/skill_feedback.py`

---

## Layer 4 — Execution (Agent Definitions)

An agent is the combination of:

```
Agent = Infrastructure (OpenClaw + MCPs)
      + Brain (Company + Department + Task)
      + Skills (domain-matched, quality-filtered)
      + Model (routing rules applied)
```

**The agent itself is the least important part. Brain + skills are the moat.**

Agents are:
- Isolated workflow runners
- Swappable — any agent can be replaced with a better model or implementation
- Replaceable — if an agent goes down, another can cold-start from the same brain
- Model-agnostic — brain and skills are model-independent

---

## Org Chart & Chain of Command

### Business Layer
| Agent | Responsibility |
|-------|---------------|
| Context Agent | Owns company brain, documentation, cross-agent context propagation |
| Planning Agent | Converts business initiatives into work plans with dependencies |
| Business Agents | Strategic initiatives driven by market data |

### Marketing Layer
| Agent | Responsibility |
|-------|---------------|
| Marketing Research Agent | Market research, competitor analysis; feeds Planning Agent |
| Social Media Content Team | Generates and schedules content (input: marketing strategy + raw content from Pablo/Trev) |

**Marketing funnel:** social media → Discord → platform access / consulting sales

### Engineering Layer (SDLC)
| Stage | Agent | Responsibility |
|-------|-------|---------------|
| 1 | Architect Agent | Specs from business/technical plans; discusses with Senior Engineers |
| 2 | Senior Engineer Agents | Discuss architecture, split work, build, reconvene |
| 3 | Code Review Team | PR review against standards |
| 4 | QA/Testing Agent | Uses `agent_mcp` (Testing MCP) to verify; actively tries to break things |
| 5 | — | Agents address feedback, iterate → merge → regression + smoke tests |
| 6 | QA Agent | Final verification before release |

### Release & Comms
| Agent | Responsibility |
|-------|---------------|
| Release Agent | Announces release through correct channels |
| Marketing Team | Writes release copy from Release Agent's notes |

### Customer-Facing
| Agent | Responsibility |
|-------|---------------|
| Sales Team Agents | Outbound/inbound, powered by domain-specific sales brain |
| Customer Service Agents | Support, escalation routing |

---

## Department Dependencies & Workflow Handoffs

```
Lead in (WhatsApp / Discord)
  → Sales Agent [qualifies]
      needs: pricing from Ops, delivery capacity from Engineering
    → closes deal
      → CS Agent [onboards]
          triggers: Marketing Agent (retention sequences)
          triggers: Engineering Agent (custom delivery work)

Content request
  → Marketing Research Agent [researches]
      → Space Scribe [ingests relevant YouTube / docs]
    → Content Team [creates]
        → Brand review
      → Social scheduler [posts]
          → engagement data feeds back → Marketing brain

Feature request / business initiative
  → Planning Agent [specs it]
    → Architect Agent [designs it]
      → Senior Engineers [build it]
        → QA Agent [verifies it]
          → Release Agent [ships it]
            → Marketing [announces it]

Completed task (any agent)
  → Skill extraction hook fires
    → Skill distilled → apps/core/skills/
      → Brain updated if new knowledge discovered
        → Next run of same task type: faster, more accurate
```

---

## Operating Principles

1. **Token efficiency first** — offload to scripts, GitHub Actions, n8n wherever possible. Don't burn context on mechanical work.
2. **Agents verify their own work** — use `agent_mcp` tools to confirm outputs before marking a task done.
3. **Event-driven chaining** — agents chain via EventBus, not polling. Task done → next stage triggered immediately.
4. **Discord is primary human↔agent channel** — all exec approvals, status updates, and decisions surface in `#claw-chat`.
5. **Never ask for permission** — act, then report. Destructive actions are logged, not gated on approval.
6. **Skill extraction is mandatory** — every completed task must trigger the skill extraction hook. No exceptions.
7. **Brain freshness over brain size** — a lean, current brain beats a bloated, stale one. Prune aggressively.
8. **Fail loud** — agents surface blockers immediately rather than silently degrading. If stuck: post to `#claw-chat`, log to TASKS.md, stop.

---

## Repository Map

| Repo | Purpose | Location |
|------|---------|----------|
| `space-agent-os` | Main monorepo: `apps/core` (Python agents), `apps/dashboard` (Next.js) | This repo |
| `space-paperclip` | Paperclip orchestration layer (fork of `paperclipai/paperclip`) | `SpaceTrev/space-paperclip` |
| `space-scribe` | YouTube/audio/doc transcription + knowledge extraction, MCP-integrated | `SpaceTrev/space-scribe` |
| `space-claw` | OpenClaw agent workspace config | `SpaceTrev/space-claw` |
| `nanoclaw` | Lightweight agent framework experiments | `SpaceTrev/nanoclaw` |

### This Repo (`space-agent-os`) Structure

```
apps/
  core/           — Python 3.12+ agent backend
    agents/       — heartbeat, orchestrator, worker agents
    config/       — models.yml, routing config
    hooks/        — skill_extraction.py, skill_feedback.py (post-task hooks)
    skills/       — distilled skill files (auto-populated)
    logs/         — audit.jsonl (all tool invocations)
  dashboard/      — Next.js 14+ web app
    app/          — App Router pages
    components/   — UI components
packages/
  shared/         — Shared TypeScript types (AgentStatus, Task, HeartbeatEvent, etc.)
ARCHITECTURE.md   — This file (company brain)
CLAUDE.md         — Agent behavior overrides
TASKS.md          — Active task queue (polled every 30 min by heartbeat)
TASKS_DONE.md     — Completed tasks with timestamps
```

---

## Task Management

- `apps/core/TASKS.md` is the source of truth for all pending work
- Heartbeat engine polls `TASKS.md` every 30 minutes
- Tags: `[URGENT]`, `[HIGH]`, `[NORMAL]`, `[LOW]`
- Completed tasks move to `TASKS_DONE.md` with timestamp and outcome summary
- Skill extraction hook fires on task completion before the task is archived

---

## Security Model

1. **Sandbox first** — all non-safe shell commands execute inside the Alpine Docker sandbox
2. **Explicit mounts only** — host filesystem access limited to declared volume mounts in `docker-compose.yml`
3. **No secrets in code** — API keys and credentials live in `.env` files, never committed
4. **Audit trail** — all tool invocations logged to `apps/core/logs/audit.jsonl`
5. **Exec approvals** — destructive/high-stakes actions route through Discord `#claw-chat` for human visibility (not gated, just logged + surfaced)

---

*Last updated: 2026-03-28. Maintained by Context Agent. Update this file whenever a new repo, agent role, infrastructure component, or operating principle is added to the system.*
