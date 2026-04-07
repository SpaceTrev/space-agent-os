---
id: company-architecture
title: System Architecture — Four Layers
vault: company
domain: architecture
tags:
  - architecture
  - layers
  - infrastructure
  - openclaw
  - brain
  - skills
priority: always
source: ARCHITECTURE.md
created: 2026-04-06
updated: 2026-04-06
token_estimate: 750
---

# System Architecture — Four Layers

```
Layer 4 — Execution:   Agents = Infrastructure + Brain(s) + Skills + MCPs
Layer 3 — Skill Library:  Distilled runs → tagged, versioned, domain-scoped
Layer 2 — Brain Layer:    Company → Department → Task brains (file system)
Layer 1 — Infrastructure: OpenClaw · Paperclip · MCPs · Model routing
```

**The moat is Layer 2 + Layer 3, not the agents.**

---

## Layer 1 — Infrastructure

### OpenClaw
- Agent runtime and session manager
- Gateway: `localhost:18789`, Tailscale: `100.102.161.30:18789`
- All LLM calls route through here (Claude Max proxy)
- Exec approvals posted to Discord `#claw-chat`

### Paperclip
- Company orchestration layer (org, budgets, heartbeats, tickets)
- Local: `localhost:3100`, Tailscale: `100.102.161.30:3100`
- Controls Space-Claw via OpenClaw gateway

### Model Routing

| Role | Model | Provider |
|------|-------|----------|
| Primary | Claude Sonnet 4.6 | OpenClaw (Claude Max) |
| Secondary | Gemini 2.0 Flash | Google API (parallel / >100k ctx) |
| Local | Qwen3-Coder 30B | Ollama (offline only, disabled by default) |

Always default to Claude Max. Gemini for parallel runs. Ollama only when `OLLAMA_ENABLED=true`.

### MCPs by Domain

| Domain | MCPs |
|--------|------|
| Engineering | GitHub, Linear, filesystem, agent_mcp |
| Marketing | Gmail, Calendar, Figma, social schedulers |
| Sales | Gmail, Calendar, CRM |
| Ops | Gmail, Calendar, Linear, Notion |
| All | Memory (MEMORY.md), Discord |

---

## Layer 2 — Brain Layer

File-system-based, not a vector DB. Three levels injected in order:

```
brain/company/   → always loaded (mission, architecture, principles)
brain/<dept>/    → loaded when agent dept matches
brain/skills/    → tag-matched to current task
```

Brain freshness beats brain size. Prune aggressively. Update after every task.

---

## Layer 3 — Skill Library

Location: `brain/skills/`

- Auto-extracted by `apps/core/brain/extractor.py` after task completion
- Tagged by domain + keywords
- Versioned via git (each skill is a markdown file)
- Loaded when skill tags intersect task keywords

---

## Layer 4 — Execution

Agent identity:
```
Agent = Infrastructure (OpenClaw + MCPs)
      + Brain (Company + Department + Task-matched skills)
      + Skills (domain-matched, quality-filtered)
      + Model (routing rules applied)
```

---

## Operating Principles

1. Token efficiency first — brain is a budget, not a firehose
2. Agents verify own work via agent_mcp before marking done
3. Event-driven chaining — no polling; task done → next stage fires
4. Discord `#claw-chat` is primary human-agent channel
5. Skill extraction is mandatory on every completed task
6. Brain freshness over size — prune, don't accumulate
7. **50% context rule** — at 50% context consumed, decide: continue or handoff
8. **Post-task knowledge loop** — update brains before closing any task
9. Sandbox first — destructive commands run inside Alpine Docker
10. No secrets in code — `.env` only, never committed
11. Audit trail — all tool invocations → `apps/core/logs/audit.jsonl`
