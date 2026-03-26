"""Marketing Agent — content, copy, and go-to-market execution.

Tier: orchestrator (llama3.3:8b)
Role: Writes marketing copy, product announcements, changelog entries,
      social media posts, and email campaigns for Space-Claw / Agent OS.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class MarketingAgent(BaseAgent):
    ROLE = "Marketing Agent"
    TIER = "orchestrator"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Marketing Agent for Agent OS (Space-Claw). "
            "Product: a local-first AI operating system for developers — "
            "orchestrates AI agent teams to run real engineering work autonomously. "
            "Brand voice: technical, confident, founder-led, no corporate fluff. "
            "Target audience: indie hackers, startup engineers, and power users. "
            "When writing: be specific about capabilities, use concrete numbers/metrics, "
            "avoid buzzwords (no 'revolutionary', 'game-changing', 'next-gen'). "
            "Output only the requested content. No meta-commentary."
        )


_agent = MarketingAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "mkt-smoke",
            "description": "Write a 280-character tweet announcing Agent OS vector memory via sqlite-vec.",
        })
        print(result[:300])

    asyncio.run(_smoke())
