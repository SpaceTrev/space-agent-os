"""
context_agent.py — Deep repo and project context agent.

Reads AGENTS.md, git log, TASKS.md, and the monorepo structure to build a rich
context snapshot.  Every other agent should receive this agent's output as their
initial context when working on platform-level tasks.

Brain integration:
  The context agent is exempt from the standard brain auto-injection (it has
  brain_context=False) because it manually composes a richer snapshot that
  already includes brain content via _gather_brain_summary().
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from agents.role_spec import AgentResult, BaseAgent, ModelTier, RoleSpec

REPO_ROOT = Path(__file__).parent.parent.parent.parent  # repo root (not apps/core)


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
            "You read AGENTS.md, git history, TASKS.md, the codebase structure, and the brain vault. "
            "Output a structured context report that other agents can use as their starting point. "
            "Be factual, specific, and concise. No fluff."
        ),
        model_tier=ModelTier.ORCHESTRATOR,
        tools=["read_file", "git_log", "list_directory"],
        memory_namespace="context",
    )

    # ContextAgent manually builds a richer snapshot — skip standard brain injection
    brain_context = False

    async def run(self, task: str, context: str = "") -> AgentResult:
        """Build a context snapshot from live repo state + brain vault, then answer the task."""
        repo_context = _gather_repo_context()
        brain_summary = _gather_brain_summary()
        parts = [p for p in [repo_context, brain_summary, context] if p.strip()]
        enriched_context = "\n\n".join(parts)
        # Call grandparent (BaseAgent) run but skip its brain injection since we do it here
        # We use super() which points to BaseAgent — brain_context=False prevents double-injection
        return await super().run(task, enriched_context)


def _gather_repo_context() -> str:
    """Read AGENTS.md, TASKS.md, recent git log, and directory tree."""
    sections: list[str] = []

    # AGENTS.md — prefer apps/core/AGENTS.md
    for candidate in [REPO_ROOT / "apps" / "core" / "AGENTS.md", REPO_ROOT / "AGENTS.md"]:
        if candidate.exists():
            sections.append(f"## AGENTS.md\n{candidate.read_text(encoding='utf-8')[:3000]}")
            break

    # TASKS.md — prefer apps/core/TASKS.md
    for candidate in [REPO_ROOT / "apps" / "core" / "TASKS.md", REPO_ROOT / "TASKS.md"]:
        if candidate.exists():
            sections.append(f"## TASKS.md\n{candidate.read_text(encoding='utf-8')[:2000]}")
            break

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


def _gather_brain_summary() -> str:
    """Load always-priority brain docs and summarize active project context."""
    sections: list[str] = []

    try:
        import sys
        _core = Path(__file__).parent.parent.parent
        if str(_core) not in sys.path:
            sys.path.insert(0, str(_core))
        from brain.loader import BrainLoader

        loader = BrainLoader()
        always_docs = loader.by_priority("always")
        if always_docs:
            lines = ["## Brain Context (always-loaded docs)"]
            for doc in always_docs:
                lines.append(f"\n### {doc.title} [{doc.id}]\n{doc.full_text[:800]}")
            sections.append("\n".join(lines))

        # Also surface project context docs
        project_docs = [
            d for d in loader.all_docs
            if "project" in d.tags or "context" in d.tags
        ]
        if project_docs:
            lines = ["## Project Context"]
            for doc in project_docs[:3]:  # cap at 3 to save tokens
                lines.append(f"\n### {doc.title}\n{doc.full_text[:600]}")
            sections.append("\n".join(lines))

    except Exception as exc:
        sections.append(f"## Brain Context\n(unavailable: {exc})")

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
