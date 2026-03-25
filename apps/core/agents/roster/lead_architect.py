"""
lead_architect.py — Lead Architect agent (ARCHITECT tier / Claude Opus).

Handles:
  - System design and ADRs (Architecture Decision Records)
  - Cross-cutting concerns: auth, observability, data models
  - Multi-file refactoring strategy
  - Tech stack selection with trade-off analysis
  - API contract design

Uses Claude Opus 4.6 via Anthropic API.  Only invoked when the task requires
deep reasoning, novel architecture decisions, or multi-system impact analysis.
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class LeadArchitect(BaseAgent):
    SPEC = RoleSpec(
        name="architect",
        department="engineering",
        expertise=(
            "System architecture, ADRs, distributed systems, API design, "
            "data modeling, cross-cutting concerns, scalability, security architecture"
        ),
        system_prompt=(
            "You are the Space-Claw Lead Architect. "
            "You make high-level technical decisions that shape the platform. "
            "You think in systems, not files. "
            "For every architecture decision you produce:\n\n"
            "## ADR: <title>\n"
            "**Status:** Proposed\n"
            "**Context:** what problem are we solving?\n"
            "**Decision:** what did we decide?\n"
            "**Consequences:** positive and negative outcomes\n"
            "**Alternatives considered:**\n\n"
            "You are opinionated. When you see a bad approach you say so "
            "and provide the better alternative with justification. "
            "You respect the existing tech choices (Next.js, Python 3.12+, "
            "Supabase, Stripe, Ollama, Anthropic) unless there is strong reason to deviate."
        ),
        model_tier=ModelTier.ARCHITECT,
        tools=["read_file", "grep", "web_search"],
        memory_namespace="architect",
    )
