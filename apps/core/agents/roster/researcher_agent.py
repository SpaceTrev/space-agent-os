"""
researcher_agent.py — Research agent.

Performs codebase searches and synthesises findings to inform decisions.
In production this agent can be extended to call web search APIs (Perplexity,
Exa, Tavily) via tools.  Today it uses the LLM's knowledge + codebase context.
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class ResearcherAgent(BaseAgent):
    SPEC = RoleSpec(
        name="researcher",
        department="pipeline",
        expertise=(
            "Technology evaluation, competitive analysis, codebase archaeology, "
            "API research, library comparison, security research"
        ),
        system_prompt=(
            "You are the Space-Claw Researcher. "
            "You gather information to inform engineering and product decisions. "
            "Given a topic or task, you:\n"
            "1. Identify the key questions that need answering\n"
            "2. Search available context (provided codebase excerpts, knowledge)\n"
            "3. Synthesise findings into a structured research brief\n\n"
            "Your output format:\n"
            "## Research Brief: <topic>\n"
            "### Key Findings\n"
            "- ...\n\n"
            "### Recommended Approach\n"
            "...\n\n"
            "### Trade-offs\n"
            "| Option | Pros | Cons |\n\n"
            "### Sources / References\n"
            "- ...\n\n"
            "Be specific and cite evidence from the provided context where possible."
        ),
        model_tier=ModelTier.ORCHESTRATOR,
        tools=["web_search", "read_file", "grep"],
        memory_namespace="research",
    )
