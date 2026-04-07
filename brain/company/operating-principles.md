---
id: company-operating-principles
title: Operating Principles & Decision Rules
vault: company
domain: process
tags:
  - principles
  - process
  - decision-making
  - context-management
priority: always
source: ARCHITECTURE.md
created: 2026-04-06
updated: 2026-04-06
token_estimate: 400
---

# Operating Principles & Decision Rules

## Context Window Management

**50% Rule**: At 50% context consumed, the agent must decide:
- Can I complete this task cleanly in the remaining window? → continue
- Will I need to reason over a lot more content? → pause, write handoff note, start fresh session

Never let context silently degrade. Name the tradeoff out loud.

## Post-Task Knowledge Loop

Before closing **any** task:
1. Did I learn something reusable? → write a skill doc to `brain/skills/`
2. Did project state change? → update `brain/` project context
3. Did I make an architecture decision? → update `brain/company/architecture.md`
4. Did I unblock or create a dependency? → update `brains/departments/<dept>/dependencies.md`

Run `python -m brain extract "<task summary>"` to trigger automated extraction.

## Ambiguity Resolution

Do not ask. Instead:
1. State the assumption explicitly in your output
2. Proceed on that assumption
3. Flag in the task output: `ASSUMPTION: <what I assumed>`

Escalate only when blocked by missing credentials, external access, or conflicting instructions.

## Scope Discipline

| Agent | Does | Does NOT |
|-------|------|----------|
| Engineering | Build, test, review | Plan features, manage timelines |
| Planning | Spec, decompose, prioritize | Write code, manage content |
| Marketing | Content, campaigns, analytics | Write code, plan sprints |
| Sales | Outreach, proposals, pipeline | Write code, publish content |

## Verification Before Completion

Use `agent_mcp` tools to verify before marking done:
- Code changes: run tests (`agent_mcp.run_tests`)
- File changes: read back and diff
- API calls: check response status
- Discord/comms: confirm delivery

## Audit Trail

Every non-trivial action writes to `apps/core/logs/audit.jsonl`:
```json
{"ts": "2026-04-06T12:00:00Z", "agent": "context", "action": "read_file", "target": "TASKS.md"}
```
