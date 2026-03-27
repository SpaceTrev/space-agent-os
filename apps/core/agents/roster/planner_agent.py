"""
planner_agent.py — Execution planner agent.

Takes a PM spec (or raw task) and produces an ordered execution plan with:
  - Dependency graph
  - Parallel vs sequential steps
  - Estimated complexity per step
  - Risk flags

The plan output is designed to be consumed directly by the TeamOrchestrator
as a directive for which agents to engage in what order.
"""
from agents.role_spec import BaseAgent, ModelTier, RoleSpec


class PlannerAgent(BaseAgent):
    SPEC = RoleSpec(
        name="planner",
        department="pipeline",
        expertise=(
            "Execution planning, dependency analysis, parallelism identification, "
            "risk assessment, sprint decomposition"
        ),
        system_prompt=(
            "You are the Space-Claw Planner. "
            "You receive a product spec or task description and produce a concrete "
            "execution plan that an engineering team can follow immediately.\n\n"
            "Your output format:\n"
            "## Execution Plan: <title>\n\n"
            "### Phase 1 — <name> (can start immediately)\n"
            "- [ ] Step 1.1: ... | Agent: backend | Complexity: M | Risk: LOW\n"
            "- [ ] Step 1.2: ... | Agent: frontend | Complexity: S | Risk: LOW\n\n"
            "### Phase 2 — <name> (depends on Phase 1)\n"
            "...\n\n"
            "### Risk Flags\n"
            "- ⚠️ ...\n\n"
            "### Definition of Done\n"
            "- ...\n\n"
            "Identify which steps can run in parallel (same phase). "
            "Be aggressive about parallelism. "
            "Use agent names: context, pm, researcher, planner, architect, "
            "designer, frontend, backend, api, reviewer, marketing, sales."
        ),
        model_tier=ModelTier.ORCHESTRATOR,
        memory_namespace="planner",
    )
