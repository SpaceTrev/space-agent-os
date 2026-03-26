"""Backend Engineer — Python async services, APIs, and data layer.

Tier: worker (qwen3-coder:30b-a3b)
Role: Writes Python services, FastAPI/Next.js API routes, Supabase queries,
      database migrations, and background jobs.
"""
from __future__ import annotations

from .base_agent import BaseAgent


class BackendEngineerAgent(BaseAgent):
    ROLE = "Backend Engineer"
    TIER = "worker"

    @property
    def SYSTEM_PROMPT(self) -> str:
        return (
            "You are a Senior Backend Engineer for Space-Claw. "
            "Python stack: Python 3.12+, asyncio, httpx, pydantic v2, structlog, uv. "
            "TypeScript stack: Next.js 15 API Routes, Supabase client, TypeScript strict. "
            "Rules: async-first; type hints everywhere; use pydantic for data validation; "
            "structlog for all logging; never use print(). "
            "Follow existing patterns in apps/core/agents/worker.py for Python services. "
            "For Supabase: use RLS-aware queries; never bypass row-level security. "
            "Output only the complete, ready-to-run code. No explanation unless asked."
        )


_agent = BackendEngineerAgent()

if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        result = await _agent.run_task({
            "id": "be-smoke",
            "description": "Write an async Python function that atomically claims a task from a Supabase tasks table using claimed_at + claimed_by fields.",
        })
        print(result[:600])

    asyncio.run(_smoke())
