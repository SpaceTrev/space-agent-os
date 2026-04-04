# space-agent-os — Project Context

## Current Product Direction (as of 2026-04-01)

### The Pivot: space-paperclip → Ground Control

The `SpaceTrev/space-paperclip` fork is being transformed into an owned product called **Ground Control** (working name). This is not a fork-maintenance effort — it is a full product pivot. The upstream Paperclip codebase is the starting point, but Ground Control diverges significantly in architecture and positioning.

**Ground Control is an agent-native OS layer for teams** — not a generic task runner or chat wrapper. The design assumption is that every team workflow maps to an agent workflow, and the integrations (Linear, GitHub) are first-class citizens, not bolt-ons.

### Why We're Diverging from Upstream Paperclip

Upstream Paperclip is designed as a general-purpose AI assistant platform. Ground Control makes opinionated choices:

| Concern | Upstream Paperclip | Ground Control |
|---|---|---|
| Task routing | Manual / prompt-based | Linear issues = task queue; labels = agent routing |
| Code workflow | No native VCS integration | GitHub connector: PRs trigger QA agents, merges close tickets |
| Context | Stateless or session-based | Brain-file system: per-task context hydration from `brains/` |
| Execution | OpenAI-compatible | OpenClaw execution layer (Claude Max via proxy) |
| Deployment | Vercel / serverless | Railway (persistent Node process — Vercel failed, see below) |

### Core Differentiators vs Upstream Paperclip

1. **Linear-native task routing** — Linear issues are the canonical task queue. Agent routing is driven by issue labels (`agent:code`, `agent:research`, `agent:qa`, etc.). No separate task queue to maintain.

2. **GitHub connector** — Pull requests are first-class events. Opening a PR triggers a QA agent. Merging a PR closes the related Linear ticket (extracted from branch name convention `feat/SPA-{issue-id}-...`).

3. **Brain-file context hydration** — Before any agent picks up a task, the system hydrates context from the `brains/` directory. Project context, product specs, and prior decisions are injected into the agent's working memory automatically.

4. **OpenClaw execution layer** — All LLM calls route through the OpenClaw gateway (Claude Max subscription proxy at `localhost:3456` / Tailscale `100.102.161.30:3100`). This decouples model selection from agent code and enables usage tracking.

### Deployment: Railway (Not Vercel)

**Vercel was attempted and abandoned.** Paperclip's architecture requires a persistent Node.js process (event bus, connection state, webhook listeners). Vercel's serverless runtime kills processes between requests, which breaks the event-driven agent loop entirely.

**Railway is the deployment target.** It supports long-running processes and provides managed Postgres. Architecture: single persistent Node process + Railway Postgres for state.

**Pending:** Railway project name and credentials from Trev are required before the first deploy can happen. Do not attempt Railway deploy until credentials are confirmed.

### Repo Structure Additions

```
brains/
  projects/
    space-agent-os/
      context.md                    ← this file
      ground-control-product-spec.md

apps/core/
  integrations/
    github_connector.py             ← GitHub webhook handler scaffold
```

## Open Questions
- How should agents handle Linear issues that are missing acceptance criteria? (Assume a best-effort spec and proceed, or escalate to Planning?)
- What's the retry/failure strategy when OpenClaw is unreachable mid-task?
- Should project brain updates be committed to git automatically, or only on explicit agent instruction?

## Key Decisions Made
- **Three-level brain system** — company / department / project brains load in order, always in context. Chosen over a vector DB retrieval approach for simplicity and determinism.
- **uv for Python deps** — `pip` is banned in `apps/core`. All Python package management via `uv`.
- **OpenClaw as the single agent gateway** — all model calls route through OpenClaw (port 18789), not directly to Anthropic/Google APIs.
- **Paperclip as orchestration layer** — Paperclip owns workflow coordination; `apps/core` agents are workers, not orchestrators.
- **Railway over Vercel** — Paperclip's persistent event loop is incompatible with serverless. Railway is the deployment target.

## Relevant File Paths
- `apps/core/agents/` — agent worker implementations
- `apps/core/agents/heartbeat.py` — heartbeat engine, polls TASKS.md every 30 min
- `apps/dashboard/` — Next.js frontend for monitoring and config
- `packages/shared/` — TypeScript types shared between dashboard and core
- `ARCHITECTURE.md` — full system architecture and operating principles
- `TASKS.md` — current task queue (source of truth for pending work)
- `brains/projects/space-agent-os/ground-control-product-spec.md` — Ground Control full product spec
