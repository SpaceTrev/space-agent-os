---
type: company
tags: [company, tech-stack]
created: "2026-04-06"
updated: "2026-04-06"
---

# Tech Stack

## Agent Runtime
- **OpenClaw** — agent gateway and runtime, runs on port `18789`. All agent invocations route through OpenClaw.
- **Paperclip** — orchestration layer, coordinates multi-agent workflows, accessible locally at `:3100` and via Tailscale at `100.102.161.30:3100`.

## Models
- **Claude Sonnet 4.6** — primary model for all reasoning, code, and planning tasks.
- **Gemini 2.0 Flash** — secondary model for parallel runs or very long context (>100k tokens).
- **Qwen3-Coder 30B (Ollama)** — local model, used only when `OLLAMA_ENABLED=true` or `/local` is invoked.

## Infrastructure
- **Vercel** — deployment for `apps/dashboard`.
- **Tailscale** — secure mesh network for internal service access. Node IP: `100.102.161.30`.
- **Discord** — primary human interface for issuing commands and receiving agent output.

## Project Tracking
- **Linear** — all tasks and issues. Project prefix: `SPA` for space-agent-os work.

## Codebase
- **space-agent-os** — Turborepo monorepo at `SpaceTrev/space-agent-os`.
  - `apps/dashboard` — Next.js 14+ frontend (Supabase auth, Stripe billing).
  - `apps/core` — Python 3.12+ agent backend (orchestrator, heartbeat, workers).
  - `packages/shared` — Shared TypeScript types and API contracts.
- **space-paperclip** — Orchestration dashboard at `SpaceTrev/space-paperclip`.

## Key Dependencies
- `pnpm` — JS package manager (monorepo root).
- `uv` — Python package manager (`apps/core`).
- `ruff` — Python linter/formatter.
- `ESLint + Prettier` — TS linter/formatter.
