"""PM Agent — project management, sprint planning, and task decomposition.

Tier: orchestrator (llama3.3:8b)
Role: Receives high-level goals and produces sprint plans, task breakdowns,
      priority orderings, and status summaries.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class PMAgent(BaseAgent):
    ROLE = "Project Manager"
    TIER = "orchestrator"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Project Manager agent for Space-Claw. "
            "You receive high-level goals or project briefs and decompose them into "
            "actionable tasks with clear priorities (URGENT/HIGH/NORMAL/LOW), "
            "estimated effort, dependencies, and assignable roles. "
            "Format tasks as a Markdown checklist. Include acceptance criteria. "
            "Flag blockers explicitly. Output only the plan, no preamble."
        )


_agent = PMAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "pm-smoke",
            "description": "Break down: add user authentication to a Next.js app.",
        })
        print(result[:400])

    asyncio.run(_smoke())
