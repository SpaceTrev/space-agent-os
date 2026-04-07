---
id: engineering-tech-stack
title: Tech Stack & Tooling Decisions
vault: engineering
domain: stack
tags:
  - stack
  - python
  - nextjs
  - typescript
  - tooling
  - uv
  - pnpm
priority: high
source: brains/company/tech-stack.md
created: 2026-04-06
updated: 2026-04-06
token_estimate: 450
---

# Tech Stack & Tooling Decisions

## Monorepo Structure

```
/                        ← Turborepo root
apps/dashboard/          ← Next.js 15 (React 19, Tailwind, Supabase, Stripe)
apps/core/               ← Python 3.12+ agent backend
packages/shared/         ← TypeScript types shared between dashboard and core
brain/                   ← Space Scribe knowledge vault (this system)
brains/                  ← Legacy brain structure (being superseded)
```

## apps/core (Python)

| Concern | Choice | Rule |
|---------|--------|------|
| Package manager | `uv` | Never use `pip` directly |
| Linting/formatting | `ruff` | `line-length = 100`, `target-version = py312` |
| HTTP client | `httpx` (async) | No `requests` |
| Structured logging | `structlog` | All log calls use `structlog` |
| Async | `asyncio` | Async-first for all I/O |
| Config | `pydantic-settings` + `.env` | No hardcoded secrets |
| Testing | `pytest` + `pytest-asyncio` | Tests in `tests/` |

### Key Dependencies
```toml
httpx, structlog, pydantic, pydantic-settings
discord-py, pyyaml, fastmcp, mcp
google-generativeai, python-dotenv
```

## apps/dashboard (TypeScript)

| Concern | Choice |
|---------|--------|
| Framework | Next.js 15, React 19 |
| Styling | Tailwind CSS |
| Package manager | `pnpm` |
| Linting | ESLint + Prettier |
| Auth/DB | Supabase (RLS on all tables, workspace_id isolation) |
| Billing | Stripe |
| LLM SDKs | `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` |
| Data viz | recharts |
| Animation | gsap |

### Render target rules
- Default to **server components**
- Client components only when interactivity requires it (`"use client"`)
- All pages fetch from `/api/*` routes (no direct Supabase calls from client)

## Deployment

| Target | Notes |
|--------|-------|
| Railway | Persistent Node process — event bus, webhook listeners. **Not Vercel.** |
| Docker | `apps/core/Dockerfile` — Alpine base |
| Sandbox | Alpine Docker for untrusted code execution (no network, no caps) |

## Banned Practices

- `pip install` in `apps/core` → use `uv add`
- `npm` or `yarn` in dashboard → use `pnpm`
- Secrets in code → `.env` only
- Vercel for Paperclip/core → Railway only (serverless kills the event loop)
