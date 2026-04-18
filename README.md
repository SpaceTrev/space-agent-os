# Space-Agent-OS

A unified **Turborepo monorepo** housing Space-Claw — a 24/7 personal AI assistant platform.

## What is this?

Space-Agent-OS merges two previously separate projects:

- **space-agent-teams** → : A Next.js web dashboard for managing agents, viewing heartbeat status, and handling billing/auth.
- **space-claw** → : A Python agent backend running a continuous orchestrator/worker loop with local Ollama models and cloud API fallbacks.

Together they form a full-stack AI operating system that runs autonomously on your hardware.

## Structure

    space-agent-os/
    ├── apps/
    │   ├── dashboard/     Next.js 14, Supabase, Stripe, Anthropic/OpenAI/Gemini SDKs
    │   └── core/          Python 3.12 agents — orchestrator, heartbeat, worker, Ollama
    ├── packages/
    │   └── shared/        Shared TypeScript types and API contracts
    ├── turbo.json
    ├── package.json       Root workspace (pnpm workspaces)
    ├── pnpm-workspace.yaml
    └── CLAUDE.md          Space-Claw persona and working instructions

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Python 3.12+
- uv (Python package manager)
- Ollama (for local model inference)

### Install

    # Install JS dependencies
    pnpm install

    # Install Python dependencies (apps/core)
    cd apps/core && uv sync

### Development

    # Run everything (dashboard + any JS tooling) via Turborepo
    pnpm dev

    # Run the Python heartbeat agent
    cd apps/core && uv run python agents/heartbeat.py

    # Run only the dashboard
    pnpm --filter @space-agent-os/dashboard dev

### Build

    pnpm build

## Model Architecture

| Tier      | Model              | Provider        | Use Case                                     |
|-----------|--------------------|-----------------|----------------------------------------------|
| Primary   | Claude Sonnet 4.6  | OpenClaw        | All tasks — reasoning, code, orchestration   |
| Secondary | Gemini 2.0 Flash   | Google API      | Parallel runs, very long context (>100k tok) |
| Local     | Qwen3-Coder 30B    | Ollama          | Offline, cost-sensitive, privacy-sensitive   |

Default to Claude Max (OpenClaw). Gemini for parallel/long-context runs. Ollama only when `OLLAMA_ENABLED=true` or `/local` invocation.

## Environment Variables

Copy  in each app and fill in your credentials:

    apps/dashboard/.env.local   — NEXT_PUBLIC_SUPABASE_URL, STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, etc.
    apps/core/.env              — ANTHROPIC_API_KEY, OPENAI_API_KEY, OLLAMA_BASE_URL, etc.

**Never commit  files.** They are gitignored.

## Packages

### @space-agent-os/shared

Shared TypeScript types imported by the dashboard and any TS tooling:

-  — idle | running | paused | error | sleeping | terminated
-  — low | medium | high | critical
-  — local | fast | balanced | powerful
-  — real-time status payload from core → dashboard
- , , 

## Contributing

This is a private personal project. See  for the working instructions and persona that governs all AI-assisted development in this repo.
