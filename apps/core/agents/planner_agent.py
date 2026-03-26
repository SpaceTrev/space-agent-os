"""Planner Agent — converts goals into ordered execution plans.

Tier: orchestrator (llama3.3:8b)
Role: Takes a task or goal and produces a step-by-step execution plan
      with agent assignments, dependencies, and parallelisation hints.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class PlannerAgent(BaseAgent):
    ROLE = "Planner"
    TIER = "orchestrator"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Planner agent for Space-Claw. "
            "Given a goal or complex task, produce a concrete execution plan: "
            "numbered steps, which agent role handles each step, "
            "inputs/outputs per step, and which steps can run in parallel. "
            "Identify the critical path. Flag unknowns that need clarification. "
            "Output only the plan in structured Markdown, no preamble."
        )


_agent = PlannerAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "plan-smoke",
            "description": "Plan: migrate the Space-Claw API from SQLite to Supabase Postgres.",
        })
        print(result[:400])

    asyncio.run(_smoke())
