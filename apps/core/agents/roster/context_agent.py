"""
context_agent.py — Deep repo and project context agent.

Reads AGENTS.md, git log, TASKS.md, and the monorepo structure to build a rich
context snapshot.  Every other agent should receive this agent's output as their
initial context when working on platform-level tasks.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from agents.role_spec import AgentResult, BaseAgent, ModelTier, RoleSpec

REPO_ROOT = Path(__file__).parent.parent.parent


class ContextAgent(BaseAgent):
    SPEC = RoleSpec(
        name="context",
        department="pipeline",
        expertise=(
            "Repository archaeology, project goal extraction, tech decision history, "
            "open issue triage, architectural intent"
        ),
        system_prompt=(
            "You are the Space-Claw Context Agent. "
            "Your sole responsibility is to deeply understand the current state of the repository: "
            "what has been built, what decisions have been made, what problems are open, "
            "and what direction the project is heading. "
            "You read AGENTS.md, git history, TASKS.md, and the codebase structure. "
            "Output a structured context report that other agents can use as their starting point. "
            "Be factual, specific, and concise. No fluff."
        ),
        model_tier=ModelTier.ORCHESTRATOR,
        tools=["read_file", "git_log", "list_directory"],
        memory_namespace="context",
    )

    async def run(self, task: str, context: str = "") -> AgentResult:
        """Build a context snapshot from the live repo state, then answer the task."""
        repo_context = _gather_repo_context()
        enriched_context = f"{repo_context}\n\n{context}".strip() if context else repo_context
        return await super().run(task, enriched_context)


def _gather_repo_context() -> str:
    """Read AGENTS.md, TASKS.md, recent git log, and directory tree."""
    sections: list[str] = []

    # AGENTS.md
    agents_md = REPO_ROOT / "AGENTS.md"
    if agents_md.exists():
        sections.append(f"## AGENTS.md\n{agents_md.read_text(encoding='utf-8')[:3000]}")

    # TASKS.md
    tasks_md = REPO_ROOT / "TASKS.md"
    if tasks_md.exists():
        sections.append(f"## TASKS.md\n{tasks_md.read_text(encoding='utf-8')[:2000]}")

    # Git log (last 20 commits)
    try:
        git_log = subprocess.check_output(
            ["git", "log", "--oneline", "-20"],
            cwd=REPO_ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        )
        sections.append(f"## Recent git log\n{git_log}")
    except Exception:
        pass

    # Directory tree (top-level only)
    try:
        tree = _simple_tree(REPO_ROOT, depth=2)
        sections.append(f"## Repository structure\n{tree}")
    except Exception:
        pass

    return "\n\n".join(sections)


def _simple_tree(root: Path, depth: int, _indent: int = 0) -> str:
    lines: list[str] = []
    try:
        for item in sorted(root.iterdir()):
            if item.name.startswith(".") or item.name in ("__pycache__", "node_modules", ".venv"):
                continue
            prefix = "  " * _indent + ("├── " if _indent else "")
            lines.append(f"{prefix}{item.name}/") if item.is_dir() else lines.append(f"{prefix}{item.name}")
            if item.is_dir() and _indent < depth - 1:
                lines.append(_simple_tree(item, depth, _indent + 1))
    except PermissionError:
        pass
    return "\n".join(lines)
