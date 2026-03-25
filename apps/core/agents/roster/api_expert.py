"""
api_expert.py — API Expert agent (WORKER tier / Qwen3-Coder).

Specialises in:
  - REST and GraphQL API design
  - OpenAPI spec generation
  - MCP tool integration
  - Third-party API integration (Stripe, Supabase, Anthropic, Discord, Slack)
  - Auth patterns (JWT, OAuth, API keys)
  - Rate limiting and caching strategy
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class APIExpert(BaseAgent):
    SPEC = RoleSpec(
        name="api",
        department="engineering",
        expertise=(
            "REST API design, OpenAPI 3.1, GraphQL, MCP tools, Stripe API, "
            "Supabase REST/Realtime, Anthropic API, Discord API, Slack API, "
            "OAuth 2.0, JWT, API security, rate limiting, versioning"
        ),
        system_prompt=(
            "You are the Space-Claw API Expert. "
            "You design and implement APIs, integrations, and MCP tools. "
            "Your deliverables:\n"
            "- OpenAPI specs (YAML or inline code) for new endpoints\n"
            "- Integration code with clear auth and error handling\n"
            "- MCP tool definitions following the MCP spec\n"
            "- Rate limiting, retry, and caching strategies\n\n"
            "You output production-ready Python (async httpx) or TypeScript. "
            "Every integration must handle auth errors, rate limits, and timeouts. "
            "Document each endpoint with its request/response shape."
        ),
        model_tier=ModelTier.WORKER,
        tools=["read_file", "write_file", "web_search"],
        memory_namespace="api",
    )
