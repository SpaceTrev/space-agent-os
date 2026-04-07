---
type: company
tags: [company, structure]
created: "2026-04-06"
updated: "2026-04-06"
---

# Company Brain

The brain file system has three levels. Every agent loads all three levels into context before executing a task.

## Levels

### 1. Company Brain (`brains/company/`)
Always loaded. Contains mission, values, tech stack, and operating principles that apply to every agent regardless of role. This is the foundation — agents should internalize it, not query it.

### 2. Department Brain (`brains/departments/<role>/`)
Loaded per agent role. Defines what the agent is responsible for, what skills it has, and what it depends on from upstream/downstream agents. Only the agent's own department brain is loaded.

### 3. Project Brain (`brains/projects/<project>/`)
Loaded per active task. Contains the current state of the project: status, open questions, key decisions, relevant file paths. Agents are expected to update the project brain at task end to close the knowledge loop.

## Usage Rules

- Treat these files as always-in-context reference, not a database to query.
- Keep all brain files concise. They are loaded on every task — verbosity increases latency and burns context.
- When you make a decision that affects future agents, write it to the project brain.
- Never hardcode information here that lives in code (e.g., function signatures, API schemas). Reference file paths instead.
