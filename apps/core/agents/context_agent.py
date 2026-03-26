"""Context Agent — builds and maintains project context summaries.

Tier: orchestrator (llama3.3:8b)
Role: Reads relevant files, code, and docs; produces concise context
      summaries that other agents can include in their prompts.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class ContextAgent(BaseAgent):
    ROLE = "Context Agent"
    TIER = "orchestrator"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Context Agent for Space-Claw, a local-first AI OS. "
            "Your job is to read project files, code, and documentation and produce "
            "a concise, structured context summary that other agents can use as a "
            "prompt prefix. Focus on: current architecture, open tasks, recent "
            "decisions, and key constraints. Be brief — aim for < 500 tokens. "
            "Output only the summary, no preamble."
        )


_agent = ContextAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "ctx-smoke",
            "description": "Summarise the Space-Claw project in 3 sentences.",
        })
        print(result[:300])

    asyncio.run(_smoke())
