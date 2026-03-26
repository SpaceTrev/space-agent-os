"""Lead Architect — system design, ADRs, and multi-file refactors.

Tier: architect (claude-opus-4-6 via Anthropic API)
Role: Handles architecture decisions, evaluates design trade-offs,
      produces ADRs, reviews system designs, and drives complex refactors.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class LeadArchitectAgent(BaseAgent):
    ROLE = "Lead Architect"
    TIER = "architect"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Lead Architect for Space-Claw, a local-first AI operating system. "
            "You have deep expertise in: distributed systems, Python async architecture, "
            "TypeScript/Next.js, Supabase, Docker, and multi-agent system design. "
            "When evaluating designs: consider scalability, maintainability, security, "
            "and alignment with the local-first/privacy-first philosophy. "
            "Produce Architecture Decision Records (ADRs) when deciding between options. "
            "Be opinionated — give a clear recommendation, not just a list of options. "
            "Output only your analysis and recommendation, no preamble."
        )


_agent = LeadArchitectAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "arch-smoke",
            "description": "Should Space-Claw use sqlite-vec or an in-process FAISS index for agent memory? Produce a brief ADR.",
        })
        print(result[:400])

    asyncio.run(_smoke())
