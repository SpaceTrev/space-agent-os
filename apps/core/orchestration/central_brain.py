"""CentralBrain — top-level coordinator for all Space-Claw agent activity.

Responsibilities:
  - Receive goals from channels (Discord, Telegram, WhatsApp, CLI)
  - Route to the correct team or swarm based on task type
  - Manage escalation from orchestrator → worker → architect tiers
  - Publish results back to originating channel
  - Maintain a run log for observability

The CentralBrain is the single entry point. Nothing dispatches agents directly.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import structlog

from agents.backend_engineer import BackendEngineerAgent
from agents.context_agent import ContextAgent
from agents.domain_agent import DomainAgent
from agents.frontend_engineer import FrontendEngineerAgent
from agents.lead_architect import LeadArchitectAgent
from agents.planner_agent import PlannerAgent
from agents.pm_agent import PMAgent
from agents.researcher_agent import ResearcherAgent
from agents.reviewer_agent import ReviewerAgent
from .swarm_coordinator import SwarmCoordinator
from .team_orchestrator import TeamConfig, TeamOrchestrator

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()


class RouteTag(str, Enum):
    CHAT = "chat"       # fast: single agent, direct response, no team pipeline
    PLAN = "plan"
    CODE = "code"
    RESEARCH = "research"
    REVIEW = "review"
    ARCHITECT = "architect"
    SWARM = "swarm"
    UNKNOWN = "unknown"


@dataclass
class BrainRequest:
    """An inbound request to the CentralBrain."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    goal: str = ""
    channel: str = "cli"
    priority: str = "NORMAL"
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    history: list[dict[str, str]] = field(default_factory=list)  # conversation history


@dataclass
class BrainResponse:
    """Result returned by the CentralBrain."""
    request_id: str
    route: RouteTag
    output: str
    agent_roles_used: list[str]
    error: str | None = None


_ROUTE_KEYWORDS: dict[RouteTag, list[str]] = {
    RouteTag.ARCHITECT: ["/architect", "/design", "/refactor", "/deep", "architecture", "system design"],
    RouteTag.REVIEW:    ["/review", "review this", "code review", "audit"],
    RouteTag.RESEARCH:  ["/research", "compare", "best library", "which is better", "investigate"],
    RouteTag.PLAN:      ["/plan", "/sprint", "break down", "decompose", "sprint plan"],
    RouteTag.SWARM:     ["/swarm", "best of", "parallel"],
    RouteTag.CODE:      ["/code", "implement", "write a", "create a", "build", "fix", "debug"],
    # CHAT has no keywords — it's the default for anything that doesn't match above
}


class CentralBrain:
    """Top-level orchestration entry point."""

    def __init__(self) -> None:
        # Instantiate the roster
        self._context = ContextAgent()
        self._pm = PMAgent()
        self._planner = PlannerAgent()
        self._researcher = ResearcherAgent()
        self._lead_arch = LeadArchitectAgent()
        self._reviewer = ReviewerAgent()
        self._be = BackendEngineerAgent()
        self._fe = FrontendEngineerAgent()
        self._domain = DomainAgent()

        # Engineering team
        self._eng_team = TeamOrchestrator(TeamConfig(
            name="Engineering",
            lead=self._planner,
            specialists=[self._be, self._fe, self._domain],
            max_concurrency=3,
        ))

        # Research swarm — lazy init on first use to avoid startup crashes
        self._research_swarm: SwarmCoordinator | None = None

    # ── Public interface ──────────────────────────────────────────────────────

    async def status(self) -> dict[str, Any]:
        """Return system health for /status command and Mission Control."""
        from agents.role_spec import get_backend_status
        backend = get_backend_status()
        return {
            "🤖 Active Backend": backend["active_backend"],
            "🧠 Active Model": backend["active_model"],
            "🔑 Anthropic API": "✅ configured" if backend["anthropic_configured"] else "❌ not set",
            "🌐 Gemini API": "✅ configured" if backend["gemini_configured"] else "❌ not set",
            "💻 Ollama": "✅ enabled" if backend["ollama_enabled"] else "off (default)",
            "⚠️ Warning": backend.get("warning", "—"),
            "🏠 Agents": f"{len(self.__dict__)} loaded",
        }

    async def handle(self, req: BrainRequest) -> BrainResponse:
        """Route a request and return the response."""
        route = self._route(req)
        log.info("brain.handle", req_id=req.id, route=route, channel=req.channel)

        try:
            output, roles = await self._dispatch(req, route)
            return BrainResponse(
                request_id=req.id,
                route=route,
                output=output,
                agent_roles_used=roles,
            )
        except Exception as exc:
            log.error("brain.error", req_id=req.id, error=str(exc))
            return BrainResponse(
                request_id=req.id,
                route=route,
                output="",
                agent_roles_used=[],
                error=str(exc),
            )

    # ── Routing ───────────────────────────────────────────────────────────────

    # Channel name → forced route (override keyword matching)
    _CHANNEL_ROUTES: dict[str, RouteTag] = {
        "dev":          RouteTag.CODE,
        "builds":       RouteTag.CODE,
        "engineering":  RouteTag.CODE,
        "code":         RouteTag.CODE,
        "planning":     RouteTag.PLAN,
        "sprint":       RouteTag.PLAN,
        "tasks":        RouteTag.PLAN,
        "research":     RouteTag.RESEARCH,
        "architect":    RouteTag.ARCHITECT,
        "design":       RouteTag.ARCHITECT,
        "swarm":        RouteTag.SWARM,
    }

    def _route(self, req: BrainRequest) -> RouteTag:
        """Classify the request — channel name takes priority over keywords."""
        # Channel-based routing (no commands needed)
        channel_name = str(req.metadata.get("channel_name", "")).lower().strip("#")
        for pattern, tag in self._CHANNEL_ROUTES.items():
            if pattern in channel_name:
                return tag

        # Keyword-based routing
        text = req.goal.lower()
        for tag in (
            RouteTag.ARCHITECT,
            RouteTag.REVIEW,
            RouteTag.RESEARCH,
            RouteTag.PLAN,
            RouteTag.SWARM,
            RouteTag.CODE,
        ):
            if any(kw in text for kw in _ROUTE_KEYWORDS[tag]):
                return tag

        return RouteTag.CHAT  # default: fluid chat with memory

    # ── Dispatch ──────────────────────────────────────────────────────────────

    async def _dispatch(
        self,
        req: BrainRequest,
        route: RouteTag,
    ) -> tuple[str, list[str]]:
        """Execute the routed request and return (output, agent_roles)."""
        task = {"id": req.id, "description": req.goal, "priority": req.priority}

        if route == RouteTag.CHAT:
            # Fast path: direct LLM call with Space-Claw persona + conversation history
            from agents.role_spec import _resolve_model, _call_openai_compat, _call_anthropic, _call_ollama, RoleSpec, ModelTier
            from agents.role_spec import CLAUDE_MAX_PROXY_URL, CLAUDE_MAX_MODEL, PRIMARY_BACKEND, ANTHROPIC_API_KEY, OLLAMA_ENABLED, ORCHESTRATOR_MODEL

            system = (
                "You are Space-Claw — an autonomous AI operating system built by Trev Benavides and Pablo Strada. "
                "You are sharp, direct, and technical. No filler. No sycophancy. "
                "You have full context of the space-agent-os project and all prior conversations. "
                "Answer concisely. For build tasks, confirm and act. For questions, be factual. "
                "You run on Claude Max via a local proxy on Trev's MacBook."
            )

            # Build messages with history
            messages: list[dict[str, str]] = [{"role": "system", "content": system}]
            if req.history:
                messages.extend(req.history)
            messages.append({"role": "user", "content": req.goal})

            backend = PRIMARY_BACKEND.lower()
            if backend == "claude_max":
                import httpx
                async with httpx.AsyncClient(base_url=CLAUDE_MAX_PROXY_URL, timeout=120.0) as client:
                    resp = await client.post("/chat/completions", json={
                        "model": CLAUDE_MAX_MODEL,
                        "messages": messages,
                        "max_tokens": 2048,
                    })
                    resp.raise_for_status()
                    output = resp.json()["choices"][0]["message"]["content"].strip()
            elif backend == "anthropic" and ANTHROPIC_API_KEY:
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
                # Convert system message
                chat_msgs = [m for m in messages if m["role"] != "system"]
                r = await client.messages.create(
                    model="claude-sonnet-4-6", max_tokens=2048,
                    system=system, messages=chat_msgs,
                )
                output = r.content[0].text
            else:
                # Ollama fallback — no history support, just use context string
                context = "\n".join(f"{m['role']}: {m['content']}" for m in (req.history or [])[-6:])
                import httpx
                async with httpx.AsyncClient(base_url="http://localhost:11434", timeout=120.0) as client:
                    resp = await client.post("/api/generate", json={
                        "model": ORCHESTRATOR_MODEL,
                        "prompt": req.goal,
                        "system": system + (f"\n\nRecent context:\n{context}" if context else ""),
                        "stream": False,
                    })
                    resp.raise_for_status()
                    output = resp.json().get("response", "").strip()

            return output, ["space-claw"]

        if route == RouteTag.ARCHITECT:
            result = await self._lead_arch.run_task(task)
            return result, [self._lead_arch.ROLE]

        if route == RouteTag.REVIEW:
            result = await self._reviewer.run_task(task)
            return result, [self._reviewer.ROLE]

        if route == RouteTag.RESEARCH:
            if self._research_swarm is None:
                self._research_swarm = SwarmCoordinator([
                    ResearcherAgent(), ResearcherAgent(), ResearcherAgent(),
                ])
            result = await self._research_swarm.consensus(
                req.goal, judge=self._lead_arch
            )
            return result, ["Researcher x3", self._lead_arch.ROLE]

        if route == RouteTag.PLAN:
            result = await self._pm.run_task(task)
            return result, [self._pm.ROLE]

        if route == RouteTag.SWARM:
            if self._research_swarm is None:
                self._research_swarm = SwarmCoordinator([
                    ResearcherAgent(), ResearcherAgent(), ResearcherAgent(),
                ])
            result = await self._research_swarm.best_of_n(req.goal)
            return result, ["Researcher x3 (best-of-N)"]

        # Default: CODE → engineering team
        team_results = await self._eng_team.run(req.goal)
        combined = "\n\n".join(
            f"**{r.assigned_role or 'Agent'}**: {r.result or r.error or '(no output)'}"
            for r in team_results
        )
        roles = list({r.assigned_role or "Unknown" for r in team_results})
        return combined, roles
