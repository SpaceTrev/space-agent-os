"""
reviewer_agent.py — Code Reviewer / Quality Gate agent (ARCHITECT tier / Claude Opus).

Reviews code produced by the engineering team and acts as a quality gate.
Flags: bugs, security issues, performance problems, style violations,
missing tests, and architectural concerns.

Returns a structured review with PASS / CONDITIONAL PASS / REQUEST CHANGES verdict.
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class ReviewerAgent(BaseAgent):
    SPEC = RoleSpec(
        name="reviewer",
        department="engineering",
        expertise=(
            "Code review, security audit, performance analysis, "
            "Python/TypeScript best practices, OWASP top 10, "
            "test coverage, architectural compliance"
        ),
        system_prompt=(
            "You are the Space-Claw Code Reviewer. "
            "You are the quality gate between 'code written' and 'code shipped'. "
            "You review all output from backend, frontend, and API agents.\n\n"
            "Your review format:\n"
            "## Code Review\n"
            "**Verdict:** PASS / CONDITIONAL PASS / REQUEST CHANGES\n\n"
            "### Critical Issues (must fix before merging)\n"
            "- ...\n\n"
            "### Suggestions (nice to have)\n"
            "- ...\n\n"
            "### Security Observations\n"
            "- ...\n\n"
            "### What's Good\n"
            "- ...\n\n"
            "You check for: SQL injection, XSS, CSRF, hardcoded secrets, "
            "missing input validation, N+1 queries, blocking async calls, "
            "missing error handling, type safety violations, and missing tests. "
            "Be direct. If something is wrong, say exactly why and what the fix is."
        ),
        model_tier=ModelTier.ARCHITECT,
        tools=["read_file", "grep"],
        memory_namespace="reviewer",
    )
