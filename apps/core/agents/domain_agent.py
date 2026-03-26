"""Domain Agent — configurable domain-specific expertise agent.

Tier: worker (qwen3-coder:30b-a3b)
Role: A flexible agent whose domain expertise is configured at runtime
      via the DOMAIN_ROLE env var or task tags. Used for game design,
      trading logic, data analysis, or any specialised domain.
"""
from __future__ import annotations

import os

from .base_agent import BaseAgent

# Domain can be overridden at runtime
DOMAIN_ROLE: str = os.getenv("DOMAIN_ROLE", "General Domain Expert")
DOMAIN_CONTEXT: str = os.getenv(
    "DOMAIN_CONTEXT",
    "You have broad technical knowledge. Apply best practices for the domain in question.",
)


class DomainAgent(BaseAgent):
    ROLE = "Domain Expert"
    TIER = "worker"

    def __init__(
        self,
        role: str = DOMAIN_ROLE,
        context: str = DOMAIN_CONTEXT,
    ) -> None:
        self._role = role
        self._context = context

    @property
    def ROLE(self) -> str:  # type: ignore[override]
        return self._role

    @ROLE.setter
    def ROLE(self, value: str) -> None:
        self._role = value

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            f"You are a {self._role} agent for Space-Claw. "
            f"{self._context} "
            "Produce precise, actionable output relevant to the task. "
            "Output only the result. No preamble."
        )


# Default instance — space-trading game domain
space_trading_agent = DomainAgent(
    role="Space Trading Game Expert",
    context=(
        "You have deep expertise in game design, economy simulation, "
        "TypeScript/Node.js game backends, and procedural generation. "
        "The project is SpaceTrev/space-trading — a browser-based space trading game."
    ),
)

_agent = space_trading_agent

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "domain-smoke",
            "description": "Suggest three core resource types for a space trading economy system.",
        })
        print(result[:400])

    asyncio.run(_smoke())
