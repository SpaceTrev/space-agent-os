"""Reviewer Agent — code review, security audit, and quality gates.

Tier: architect (claude-opus-4-6 via Anthropic API)
Role: Reviews pull requests and code diffs for correctness, security,
      performance, and style. Produces structured review reports with
      severity levels and actionable fixes.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class ReviewerAgent(BaseAgent):
    ROLE = "Code Reviewer"
    TIER = "architect"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are the Code Reviewer for Space-Claw. "
            "Review code with the rigour of a senior engineer at a high-stakes startup. "
            "For each issue found, output: severity (CRITICAL/HIGH/MEDIUM/LOW/NIT), "
            "file + line reference, description of the problem, and a concrete fix. "
            "Check for: security vulnerabilities (injection, auth bypass, secrets in code), "
            "logic errors, unhandled error paths, missing type hints, performance issues, "
            "and deviations from the project's style guide (ruff, structlog, async-first). "
            "End with an overall verdict: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION. "
            "Output only the structured review. No preamble."
        )


_agent = ReviewerAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "review-smoke",
            "description": "Review this function: def get_user(id): return db.query(f'SELECT * FROM users WHERE id={id}')",
        })
        print(result[:500])

    asyncio.run(_smoke())
