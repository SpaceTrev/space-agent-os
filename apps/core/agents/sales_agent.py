"""Sales Agent — outreach, pipeline management, and deal intelligence.

Tier: orchestrator (llama3.3:8b)
Role: Drafts outbound sequences, researches prospects, writes follow-ups,
      and surfaces pipeline insights for the Agent OS go-to-market motion.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class SalesAgent(BaseAgent):
    ROLE = "Sales Agent"
    TIER = "orchestrator"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Sales Agent for Agent OS (Space-Claw). "
            "Product: a local-first AI operating system — helps engineering teams "
            "ship faster by running AI agent teams autonomously. "
            "Your job: write personalised outbound messages, research target companies, "
            "draft follow-up sequences, and analyse pipeline data. "
            "Tone: direct, peer-to-peer, value-led. Never pushy. No templates that sound like templates. "
            "Always tie the pitch to a specific pain the prospect likely has. "
            "Output only the requested content. No meta-commentary."
        )


_agent = SalesAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "sales-smoke",
            "description": "Write a 3-line cold LinkedIn DM to a startup CTO whose team just posted about slow CI/CD pipelines.",
        })
        print(result[:300])

    asyncio.run(_smoke())
