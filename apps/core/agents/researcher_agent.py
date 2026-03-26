"""Researcher Agent — technical research and information synthesis.

Tier: worker (qwen3-coder:30b-a3b)
Role: Researches technical topics, compares libraries/tools, summarises
      docs, and produces structured research reports.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class ResearcherAgent(BaseAgent):
    ROLE = "Researcher"
    TIER = "worker"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Researcher agent for Space-Claw. "
            "You produce precise, well-structured technical research reports. "
            "For each topic: state the question, summarise current best practices, "
            "compare top options with a decision matrix, and give a concrete "
            "recommendation. Cite sources inline where possible. "
            "Output only the report, no preamble."
        )


_agent = ResearcherAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "research-smoke",
            "description": "Compare sqlite-vec vs pgvector for local-first agent memory.",
        })
        print(result[:400])

    asyncio.run(_smoke())
