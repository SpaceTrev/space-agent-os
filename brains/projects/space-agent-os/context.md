# space-agent-os — Project Context

## What It Is
space-agent-os is the autonomous agent operating system for Space Trading. It provides the runtime infrastructure for running AI agents as a coordinated team: orchestration via Paperclip, task routing via OpenClaw, a Next.js dashboard for humans to monitor and configure, and a Python backend for agent execution.

## Status
**Active development.**

## Current Milestone
**Paperclip + Linear bridge end-to-end.**
Goal: agents receive tasks from Linear via Paperclip, execute them, and write results back to Linear — with no human in the loop for standard tasks.

## In Flight
- Brain file system scaffold (SPA-89) — establishing the three-level context loading architecture for all agents.

## Open Questions
- How should agents handle Linear issues that are missing acceptance criteria? (Assume a best-effort spec and proceed, or escalate to Planning?)
- What's the retry/failure strategy when OpenClaw is unreachable mid-task?
- Should project brain updates be committed to git automatically, or only on explicit agent instruction?

## Key Decisions Made
- **Three-level brain system** — company / department / project brains load in order, always in context. Chosen over a vector DB retrieval approach for simplicity and determinism. Low-frequency updates mean staleness is manageable.
- **uv for Python deps** — `pip` is banned in `apps/core`. All Python package management via `uv`.
- **OpenClaw as the single agent gateway** — all model calls route through OpenClaw (port 18789), not directly to Anthropic/Google APIs. Enables unified logging and model routing.
- **Paperclip as orchestration layer** — Paperclip owns workflow coordination; `apps/core` agents are workers, not orchestrators.

## Relevant File Paths
- `apps/core/agents/` — agent worker implementations.
- `apps/core/agents/heartbeat.py` — heartbeat engine, polls TASKS.md every 30 min.
- `apps/dashboard/` — Next.js frontend for monitoring and config.
- `packages/shared/` — TypeScript types shared between dashboard and core.
- `ARCHITECTURE.md` — full system architecture and operating principles.
- `TASKS.md` — current task queue (source of truth for pending work).
- `brains/` — this brain file system.
