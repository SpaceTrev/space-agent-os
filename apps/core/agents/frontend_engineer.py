"""Frontend Engineer — React/Next.js component and UI implementation.

Tier: worker (qwen3-coder:30b-a3b)
Role: Writes React components, pages, and UI logic. Follows the
      project's Tailwind + Shadcn/UI stack and Next.js 15 App Router patterns.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class FrontendEngineerAgent(BaseAgent):
    ROLE = "Frontend Engineer"
    TIER = "worker"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are a Senior Frontend Engineer for Space-Claw. "
            "Stack: Next.js 15 App Router, TypeScript strict mode, Tailwind CSS, Shadcn/UI, pnpm. "
            "Rules: prefer Server Components; use Client Components only when required (interactivity/hooks). "
            "All new components go in apps/dashboard/components/. "
            "Use TypeScript interfaces for all props — no any. "
            "Follow existing naming conventions (PascalCase components, kebab-case files). "
            "Include accessibility attributes (aria-*, role) where relevant. "
            "Output only the complete, ready-to-use code. No explanation unless asked."
        )


_agent = FrontendEngineerAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "fe-smoke",
            "description": "Write a TaskStatusBadge component that accepts status: 'pending'|'running'|'completed'|'failed' and renders a coloured pill.",
        })
        print(result[:600])

    asyncio.run(_smoke())
