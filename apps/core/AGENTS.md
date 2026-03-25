# Space-Claw Agent Architecture

## Overview

Space-Claw is a multi-agent AI operating system built around three compute tiers,
a full agent roster, and a Discord-native control channel.

The system supports three execution modes:
- **Single agent** — one specialist handles a focused task
- **Team** — a coordinated pipeline of agents working sequentially or in parallel
- **Swarm** — multiple teams working in parallel, synthesised into a unified result

---

## Compute Tiers

| Tier | Model | Provider | Use |
|------|-------|----------|-----|
| Orchestrator | `llama3.3:8b` | Ollama (local) | Routing, triage, heartbeat, classification |
| Worker | `qwen3-coder:30b-a3b` | Ollama (local) | Code gen, logic, GTM content, analysis |
| Architect | `claude-opus-4-6` | Anthropic API | Deep reasoning, architecture, design, review |

**Default rule:** Ollama for everything. Escalate to Architect only for multi-file
refactors, novel architecture decisions, UX/UI design, or code review.

---

## Orchestration Layers

```
Discord Message
      │
      ▼
DiscordChannel (channels/discord_channel.py)
      │  IncomingRequest
      ▼
CentralBrain (orchestration/central_brain.py)
      │  classifies: SINGLE / TEAM / SWARM
      ├─► BaseAgent.run()          [SINGLE]
      ├─► TeamOrchestrator.run()   [TEAM]
      └─► SwarmCoordinator.run()   [SWARM]
                │
                ▼
           AgentResult / TeamResult / SwarmResult
                │
                ▼
         Discord reply (embed or plain text)
```

### CentralBrain
- Receives `IncomingRequest` from Discord or API
- Uses `llama3.3:8b` to classify scope: SINGLE / TEAM / SWARM
- `/swarm <task>` forces swarm mode
- Picks the right agent, team preset, or swarm preset
- Returns a formatted string for Discord

### TeamOrchestrator
- Manages one team of `BaseAgent` instances
- **Sequential mode**: each agent's output becomes the next agent's context
- **Parallel mode**: all agents run simultaneously; outputs are merged
- Returns `TeamResult` with per-agent results and final output

### SwarmCoordinator
- Runs multiple `TeamConfig`s in parallel via `asyncio.gather`
- Optionally runs a synthesis pass (orchestrator tier) over all team outputs
- Returns `SwarmResult` with team results and synthesised output

---

## Agent Roster

### Pipeline Agents (always available in every team)

| Agent | File | Tier | Role |
|-------|------|------|------|
| `context` | `roster/context_agent.py` | Orchestrator | Reads AGENTS.md, git log, TASKS.md; builds repo context snapshot |
| `pm` | `roster/pm_agent.py` | Orchestrator | NL → structured spec with acceptance criteria and subtasks |
| `researcher` | `roster/researcher_agent.py` | Orchestrator | Codebase + web research; produces structured research briefs |
| `planner` | `roster/planner_agent.py` | Orchestrator | Spec → ordered execution plan with dependencies and risk flags |

### Engineering Team

| Agent | File | Tier | Role |
|-------|------|------|------|
| `architect` | `roster/lead_architect.py` | **Architect** | System design, ADRs, cross-cutting concerns |
| `designer` | `roster/lead_designer.py` | **Architect** | UX/UI specs, design system, component handoff |
| `frontend` | `roster/frontend_engineer.py` | Worker | React/Next.js implementation (TS strict, server components) |
| `backend` | `roster/backend_engineer.py` | Worker | Python async services, APIs, integrations |
| `api` | `roster/api_expert.py` | Worker | REST/GraphQL design, OpenAPI specs, MCP tools, integrations |
| `reviewer` | `roster/reviewer_agent.py` | **Architect** | Code review quality gate: security, bugs, performance |

### GTM Team

| Agent | File | Tier | Role |
|-------|------|------|------|
| `marketing` | `roster/marketing_agent.py` | Worker | Content, campaigns, SEO, developer marketing |
| `sales` | `roster/sales_agent.py` | Worker | Outreach, proposals, pipeline, competitive positioning |

### Dynamic Domain Agents

Instantiated on demand from `config/roles/*.yaml`:

| Role YAML | Agent name | Expertise |
|-----------|------------|-----------|
| `quant.yaml` | `quant` | Algorithmic trading, backtesting, risk metrics |
| `market_analyst.yaml` | `market_analyst` | Market sizing, competitive landscape, TAM/SAM/SOM |
| `financial_researcher.yaml` | `financial_researcher` | Financial statements, DCF, valuation, crypto research |

Add any new role by creating `config/roles/<name>.yaml` — no code changes needed.

---

## Team Presets

| Preset | Agents | Mode | Purpose |
|--------|--------|------|---------|
| `pipeline` | context → researcher → pm → planner | Sequential | Convert any NL request into a structured spec + plan |
| `engineering` | architect → frontend + backend → reviewer | Sequential | Full build cycle |
| `gtm` | marketing + sales | Parallel | Launch content and outreach |
| `full` | All pipeline + engineering agents | Sequential | End-to-end feature from NL to reviewed code |
| `design` | designer → frontend | Sequential | UX design to implementation |
| `research` | context + researcher | Parallel | Deep context + research gathering |

---

## Swarm Presets

| Preset | Teams | Purpose |
|--------|-------|---------|
| `feature` | pipeline + engineering + gtm (parallel) | Full feature launch: spec, code, and marketing simultaneously |
| `analysis` | research + pipeline (parallel) | Deep analysis + structured planning |

---

## RoleSpec System

All agents are defined by a `RoleSpec` dataclass (`agents/role_spec.py`):

```python
@dataclass
class RoleSpec:
    name: str               # short identifier used in routing
    department: str         # pipeline / engineering / gtm / domain
    expertise: str          # one-liner for routing decisions
    system_prompt: str      # the agent's full persona and output format
    model_tier: ModelTier   # ORCHESTRATOR / WORKER / ARCHITECT
    tools: list[str]        # declared tools (not enforced yet)
    memory_namespace: str   # future: per-agent persistent memory
```

Built-in roster agents hardcode their `SPEC` at class level.
Domain agents load their spec from YAML at runtime.

---

## Discord Control Channel

**Primary interface** for the system.

Bot commands:
- `/ask <message>` — send any task; Central Brain classifies and routes
- `/swarm <task>` — force swarm mode (multiple teams in parallel)
- `/status` — system health: Ollama, models, available teams
- `/tasks` — dump current TASKS.md

Message routing:
- DMs to the bot → routed to Central Brain
- `@Space-Claw <message>` → routed to Central Brain
- Any message in `DISCORD_CHANNEL_ID` → routed to Central Brain

Heartbeat posts a summary every `HEARTBEAT_INTERVAL` seconds (default 30 min)
showing task counts, urgent items, and the last heartbeat timestamp.

---

## Execution Sandbox

`execution/backend.py` provides sandboxed code execution:

```
DockerBackend  — default; runs in Alpine with --network=none --cap-drop=ALL
NullBackend    — fallback for CI/environments without Docker
```

The `DockerBackend` enforces:
- No network (`--network=none`)
- No Linux capabilities (`--cap-drop=ALL --security-opt=no-new-privileges`)
- Read-only root filesystem (`--read-only`)
- 512 MB RAM cap, 1 CPU, 64 MB tmpfs
- Auto-removed container (`--rm`)
- Unprivileged user (`--user=nobody`)

---

## Adding a New Agent Role

**Hardcoded roster agent:**
1. Create `agents/roster/<name>_agent.py` with `SPEC = RoleSpec(...)` and `class MyAgent(BaseAgent)`
2. Add to `agents/roster/__init__.py`
3. Add to the `_make_agent()` mapping in `orchestration/central_brain.py`

**Dynamic domain agent (YAML):**
1. Create `config/roles/<name>.yaml` with `name`, `department`, `expertise`, `system_prompt`, `model_tier`, `tools`, `memory_namespace`
2. Instantiate with `DomainAgent.by_name("<name>")` anywhere in the codebase
3. No restart required — loaded at call time

---

## File Map

```
apps/core/
├── agents/
│   ├── role_spec.py          ← ModelTier, RoleSpec, BaseAgent, AgentResult, call_llm
│   ├── heartbeat.py          ← polls TASKS.md, posts Discord summaries
│   ├── orchestrator.py       ← Ollama connectivity + model tier router
│   ├── worker.py             ← queue consumer, streams Ollama completions
│   ├── discord_bot.py        ← standalone Discord bot (slash commands only)
│   └── roster/
│       ├── context_agent.py
│       ├── pm_agent.py
│       ├── researcher_agent.py
│       ├── planner_agent.py
│       ├── lead_architect.py
│       ├── lead_designer.py
│       ├── frontend_engineer.py
│       ├── backend_engineer.py
│       ├── api_expert.py
│       ├── reviewer_agent.py
│       ├── domain_agent.py   ← base for all YAML-loaded agents
│       ├── marketing_agent.py
│       └── sales_agent.py
├── channels/
│   └── discord_channel.py    ← Discord adapter → CentralBrain
├── orchestration/
│   ├── central_brain.py      ← classify + route + respond
│   ├── team_orchestrator.py  ← manage one team (sequential/parallel)
│   └── swarm_coordinator.py  ← manage multiple teams in parallel
├── execution/
│   └── backend.py            ← ExecutionBackend ABC, DockerBackend, NullBackend
├── config/
│   ├── models.yml
│   ├── channels.yml
│   └── roles/
│       ├── quant.yaml
│       ├── market_analyst.yaml
│       └── financial_researcher.yaml
└── AGENTS.md                 ← this file
```
