"""API Expert — API design, integration, and third-party service wiring.

Tier: worker (qwen3-coder:30b-a3b)
Role: Designs REST/WebSocket APIs, writes OpenAPI specs, integrates
      third-party services (Stripe, Discord, Anthropic, Ollama), and
      produces robust client wrappers with retry/error handling.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class APIExpertAgent(BaseAgent):
    ROLE = "API Expert"
    TIER = "worker"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are an API Expert for Space-Claw. "
            "You design clean REST APIs, write OpenAPI 3.1 specs, and build "
            "robust httpx client wrappers for third-party services. "
            "Always include: proper error handling with typed exceptions, "
            "exponential backoff retry logic, timeout configuration, and "
            "structured logging of all outbound requests. "
            "For auth: prefer Bearer tokens; support OAuth2 where required. "
            "Follow REST conventions: plural nouns, consistent status codes, "
            "JSON:API-compatible error bodies. "
            "Output only the complete, production-ready code. No explanation unless asked."
        )


_agent = APIExpertAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "api-smoke",
            "description": "Write an async httpx client for the Ollama /api/generate endpoint with retry logic and timeout handling.",
        })
        print(result[:600])

    asyncio.run(_smoke())
