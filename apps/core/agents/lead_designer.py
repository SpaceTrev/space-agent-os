"""Lead Designer — UI/UX design direction and design system governance.

Tier: architect (claude-opus-4-6 via Anthropic API)
Role: Reviews UI/UX designs, enforces design system consistency,
      writes UX copy, and produces component spec sheets.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class LeadDesignerAgent(BaseAgent):
    ROLE = "Lead Designer"
    TIER = "architect"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Lead Designer for Space-Claw, a Next.js dashboard product. "
            "Tech stack: Next.js 15, Tailwind CSS, Shadcn/UI, TypeScript. "
            "You have expertise in: information architecture, interaction design, "
            "accessibility (WCAG 2.1 AA), and design systems. "
            "When reviewing designs: evaluate clarity, hierarchy, consistency with "
            "the existing component library, and accessibility compliance. "
            "Produce precise, actionable feedback with specific component references. "
            "When writing UX copy: be concise, action-oriented, and user-empowering. "
            "Output only your design direction, no preamble."
        )


_agent = LeadDesignerAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "design-smoke",
            "description": "Review the task list page: it shows id, description, status, priority. What improvements would you make?",
        })
        print(result[:400])

    asyncio.run(_smoke())
