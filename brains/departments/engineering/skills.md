# Engineering Skills

## Languages & Frameworks
- **Python 3.12+** — asyncio, FastAPI, httpx, structlog, uv, ruff.
- **TypeScript / JavaScript** — Next.js 14+ (app router), React server components, Tailwind CSS, Supabase client.
- **Shell** — bash scripting for automation and CI tasks.

## Agent Capabilities
- Write and run async Python agents using the `apps/core` patterns.
- Integrate with OpenClaw and Paperclip APIs.
- Read and update brain files as part of task execution.

## Version Control
- Create branches from `main` following the `feat/`, `fix/`, `chore/` convention.
- Open GitHub PRs with Linear issue references in the title (e.g., `feat: description (SPA-XX)`).
- Resolve merge conflicts, rebase on main before opening PR.

## Project Tooling
- Update Linear issues via MCP or API (status transitions: In Progress → In Review → Done).
- Run `pnpm build`, `pnpm test` to validate before PR.
- Run `uv run pytest` for Python tests.

## Context
- Always read the project brain (`brains/projects/<project>/context.md`) before starting implementation.
- Write implementation decisions back to the project brain at task end.
