"""
assembler.py — Assemble a context packet from selected brain docs.

Takes an ordered list of BrainDoc objects and renders them into a single
string formatted for LLM context injection. Respects a token budget and
emits a utilization summary at the end.

Usage:
    from brain import BrainAssembler

    assembler = BrainAssembler()
    context = assembler.build(department="engineering", task="...")
    result = await call_llm(spec, task, context=context)
"""
from __future__ import annotations

import os
from pathlib import Path

import structlog

from brain.loader import BrainDoc, BrainLoader
from brain.selector import BrainSelector

log = structlog.get_logger()

# Default token budget — ~10% of Claude Sonnet 4.6's 200k context window
DEFAULT_TOKEN_BUDGET: int = int(os.getenv("BRAIN_TOKEN_BUDGET", "20000"))

# Header injected at the start of every context packet
_PACKET_HEADER = """\
# Brain Context — Space Scribe
> Auto-assembled by apps/core/brain/assembler.py
> Docs are ordered: company (always) → department → skills → task-relevant
"""

# Footer injected at the end of every context packet
_PACKET_FOOTER_TPL = """\

---
*Brain packet: {doc_count} docs, ~{tokens_used} tokens of {token_budget} budget ({pct:.0f}%)*
"""


class BrainAssembler:
    """
    Builds a brain context packet for injection into an agent's LLM call.

    The assembler is stateless after init — it holds a shared loader and
    selector and can be called concurrently from multiple agents.

    Args:
        brain_root: path to the brain/ vault (default: BRAIN_ROOT env var)
        token_budget: max tokens for the assembled packet
    """

    def __init__(
        self,
        brain_root: Path | None = None,
        token_budget: int = DEFAULT_TOKEN_BUDGET,
    ) -> None:
        from brain.loader import BRAIN_ROOT
        self._root = brain_root or BRAIN_ROOT
        self._token_budget = token_budget
        self._loader = BrainLoader(self._root)
        self._selector = BrainSelector(self._loader)

    def build(
        self,
        department: str,
        task: str,
        extra_context: str = "",
        max_skills: int = 5,
    ) -> str:
        """
        Assemble and return the brain context string.

        Args:
            department:    agent department ("engineering", "marketing", etc.)
            task:          task description — drives keyword-based selection
            extra_context: additional free-form text appended after brain docs
            max_skills:    max skill docs to include

        Returns:
            Multi-section markdown string ready for injection as LLM context.
        """
        docs = self._selector.select(
            department=department,
            task=task,
            max_tokens=self._token_budget,
            max_skills=max_skills,
        )

        return _render_packet(
            docs=docs,
            token_budget=self._token_budget,
            extra_context=extra_context,
        )

    def reload(self) -> None:
        """Re-scan the brain vault from disk (call after writing new docs)."""
        self._loader.reload()

    @property
    def loader(self) -> BrainLoader:
        return self._loader

    @property
    def selector(self) -> BrainSelector:
        return self._selector


# ─── Rendering ────────────────────────────────────────────────────────────────


def _render_packet(
    docs: list[BrainDoc],
    token_budget: int,
    extra_context: str = "",
) -> str:
    """Render an ordered list of BrainDocs into an injectable context string."""
    sections: list[str] = [_PACKET_HEADER]
    tokens_used = 0

    # Group by vault for readability
    by_vault: dict[str, list[BrainDoc]] = {}
    for doc in docs:
        by_vault.setdefault(doc.vault, []).append(doc)

    vault_order = ["company", "engineering", "marketing", "sales", "operations", "skills"]
    for vault in vault_order:
        vault_docs = by_vault.get(vault, [])
        if not vault_docs:
            continue

        sections.append(f"\n## [{vault.upper()}]")
        for doc in vault_docs:
            sections.append(f"\n### {doc.title}\n")
            sections.append(doc.full_text)
            sections.append("")  # blank line between docs
            tokens_used += doc.tokens

    if extra_context.strip():
        sections.append("\n## [TASK CONTEXT]")
        sections.append(extra_context.strip())
        tokens_used += len(extra_context) // 4

    pct = (tokens_used / token_budget * 100) if token_budget > 0 else 0
    sections.append(
        _PACKET_FOOTER_TPL.format(
            doc_count=len(docs),
            tokens_used=tokens_used,
            token_budget=token_budget,
            pct=pct,
        )
    )

    log.debug(
        "brain.assembler.packet_built",
        docs=len(docs),
        tokens_used=tokens_used,
        pct=round(pct, 1),
    )

    return "\n".join(sections)
