---
id: engineering-agents
title: Agent Roster & Execution Model
vault: engineering
domain: agents
tags:
  - agents
  - roster
  - orchestration
  - team
  - swarm
priority: high
source: apps/core/AGENTS.md
created: 2026-04-06
updated: 2026-04-06
token_estimate: 700
---

# Agent Roster & Execution Model

## Execution Modes

| Mode | When | How |
|------|------|-----|
| Single | Focused, well-scoped task | One specialist agent |
| Team | Multi-step, sequential or parallel | `TeamOrchestrator` |
| Swarm | Multiple concerns simultaneously | `SwarmCoordinator` (parallel teams) |

## Orchestration Path

```
Discord / API → CentralBrain (classify: SINGLE/TEAM/SWARM)
  ├─ SINGLE → BaseAgent.run()
  ├─ TEAM   → TeamOrchestrator.run()
  └─ SWARM  → SwarmCoordinator.run() → parallel teams + synthesis
```

## Pipeline Agents (always available)

| Agent | File | Role |
|-------|------|------|
| `context` | `roster/context_agent.py` | Repo snapshot, brain hydration |
| `pm` | `roster/pm_agent.py` | NL → structured spec + acceptance criteria |
| `researcher` | `roster/researcher_agent.py` | Codebase + web research briefs |
| `planner` | `roster/planner_agent.py` | Spec → execution plan with deps + risk flags |

## Engineering Agents

| Agent | File | Tier | Role |
|-------|------|------|------|
| `architect` | `roster/lead_architect.py` | Architect | System design, ADRs |
| `designer` | `roster/lead_designer.py` | Architect | UX/UI specs, design system |
| `frontend` | `roster/frontend_engineer.py` | Worker | React/Next.js (TS strict, server components) |
| `backend` | `roster/backend_engineer.py` | Worker | Python async services, APIs |
| `api` | `roster/api_expert.py` | Worker | REST/GraphQL, OpenAPI, MCP tools |
| `reviewer` | `roster/reviewer_agent.py` | Architect | Code review: security, bugs, performance |

## GTM Agents

| Agent | Role |
|-------|------|
| `marketing` | Content, campaigns, SEO |
| `sales` | Outreach, proposals, pipeline |

## Team Presets

| Preset | Agents | Mode |
|--------|--------|------|
| `pipeline` | context → researcher → pm → planner | Sequential |
| `engineering` | architect → frontend + backend → reviewer | Sequential |
| `gtm` | marketing + sales | Parallel |
| `full` | pipeline + engineering | Sequential |
| `research` | context + researcher | Parallel |

## Adding an Agent

**Hardcoded:** create `roster/<name>_agent.py` with `SPEC = RoleSpec(...)`, add to `__init__.py` and `central_brain.py` mapping.

**Dynamic (YAML):** create `config/roles/<name>.yaml` — loaded at call time via `DomainAgent.by_name("<name>")`. No restart needed.

## RoleSpec Fields

```python
@dataclass
class RoleSpec:
    name: str            # routing key
    department: str      # pipeline/engineering/gtm/domain
    expertise: str       # one-liner for routing decisions
    system_prompt: str   # full persona + output format
    model_tier: ModelTier  # ORCHESTRATOR/WORKER/ARCHITECT
    tools: list[str]     # declared tool names
    memory_namespace: str  # per-agent memory key
```
