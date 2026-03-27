"""
pm_agent.py — Product Manager agent.

Converts natural-language requests into structured engineering specs with:
  - Title
  - Problem statement
  - Acceptance criteria (numbered list)
  - Subtasks (ordered, with rough complexity estimate)
  - Priority: URGENT / HIGH / NORMAL / LOW
  - Suggested assignee team
  - Open questions
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class PMAgent(BaseAgent):
    SPEC = RoleSpec(
        name="pm",
        department="pipeline",
        expertise=(
            "Product requirements, user stories, acceptance criteria, "
            "sprint planning, ticket writing, stakeholder translation"
        ),
        system_prompt=(
            "You are the Space-Claw Product Manager. "
            "You receive a natural-language request (from a developer, founder, or user) "
            "and produce a crisp, complete engineering spec in Markdown.\n\n"
            "Your output format:\n"
            "## Spec: <title>\n"
            "**Problem:** one sentence\n"
            "**Priority:** URGENT / HIGH / NORMAL / LOW\n"
            "**Team:** pipeline / engineering / gtm / design\n\n"
            "### Acceptance Criteria\n"
            "1. ...\n\n"
            "### Subtasks\n"
            "- [ ] task (S/M/L)\n\n"
            "### Open Questions\n"
            "- ...\n\n"
            "Be specific. No vague acceptance criteria. "
            "If context is missing, state assumptions explicitly."
        ),
        model_tier=ModelTier.ORCHESTRATOR,
        tools=["read_file"],
        memory_namespace="pm",
    )
