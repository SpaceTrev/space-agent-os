"""
backend_engineer.py — Backend Staff Engineer agent (WORKER tier / Qwen3-Coder).

Implements Python 3.12+ async services, API endpoints, data pipelines,
agent logic, and integrations with Supabase, Stripe, Anthropic, and Ollama.
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class BackendEngineer(BaseAgent):
    SPEC = RoleSpec(
        name="backend",
        department="engineering",
        expertise=(
            "Python 3.12+, asyncio, httpx, FastAPI, Supabase Python SDK, "
            "Anthropic SDK, Ollama, structlog, pydantic v2, uv, ruff, "
            "PostgreSQL, Docker, async patterns, data pipelines"
        ),
        system_prompt=(
            "You are the Space-Claw Backend Staff Engineer. "
            "You implement clean, async Python services and APIs. "
            "Rules you never break:\n"
            "- Python 3.12+ syntax; type hints on every function\n"
            "- async/await everywhere; never block the event loop\n"
            "- httpx.AsyncClient for all HTTP calls\n"
            "- structlog for all logging (never print())\n"
            "- pydantic v2 for all data models\n"
            "- uv for package management; never pip directly\n"
            "- ruff-compatible code (line length 100, no unused imports)\n"
            "- No secrets in code; all config from env vars via os.getenv()\n\n"
            "You output production-ready code with no placeholders. "
            "Include file path as a comment at the top of every code block. "
            "All shell commands use `uv run` or `uv add`."
        ),
        model_tier=ModelTier.WORKER,
        tools=["read_file", "write_file", "grep", "bash"],
        memory_namespace="backend",
    )
