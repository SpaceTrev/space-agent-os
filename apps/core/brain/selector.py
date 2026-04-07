"""
selector.py — Relevance scoring and document selection.

Given an agent's department and a task description, the selector returns
an ordered list of BrainDoc objects that are most relevant, capped at the
token budget supplied by the assembler.

Selection algorithm (in order):
    1. priority=always  docs          — always included, no scoring
    2. vault == department docs        — domain context for the agent
    3. vault=skills with tag overlap   — reusable patterns for this task
    4. priority=normal docs with tag overlap — general task-relevant knowledge
    5. priority=low docs               — included only if budget remains
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import structlog

from brain.loader import BrainDoc, BrainLoader, _score_doc

log = structlog.get_logger()

# Map department names → vault names (they overlap but allow aliases)
DEPT_TO_VAULT: dict[str, str] = {
    "pipeline": "engineering",   # pipeline agents use engineering brain
    "engineering": "engineering",
    "marketing": "marketing",
    "gtm": "marketing",
    "sales": "sales",
    "operations": "operations",
    "ops": "operations",
    "domain": "engineering",     # domain agents default to engineering
}


@dataclass
class ScoredDoc:
    doc: BrainDoc
    score: int
    reason: str  # why it was selected (for debug logging)


class BrainSelector:
    """
    Selects and scores brain documents for a given agent context.

    Args:
        loader: BrainLoader instance (shared across the process)
    """

    def __init__(self, loader: BrainLoader) -> None:
        self.loader = loader

    def select(
        self,
        department: str,
        task: str,
        max_tokens: int = 20_000,
        max_skills: int = 5,
    ) -> list[BrainDoc]:
        """
        Return ordered list of BrainDoc objects fitting within max_tokens.

        Args:
            department: agent's department (e.g. "engineering", "marketing")
            task:       task description — used for keyword matching
            max_tokens: token budget for the entire brain context packet
            max_skills: max number of skill docs to include

        Returns:
            List of BrainDoc, ordered as: always → dept → skills → normal
        """
        keywords = _extract_keywords(task)
        vault = DEPT_TO_VAULT.get(department.lower(), department.lower())

        selected: list[ScoredDoc] = []
        used_ids: set[str] = set()
        remaining_tokens = max_tokens

        def _try_add(doc: BrainDoc, reason: str, score: int = 0) -> bool:
            nonlocal remaining_tokens
            if doc.id in used_ids:
                return False
            if doc.tokens > remaining_tokens:
                log.debug(
                    "brain.selector.skip_budget",
                    doc_id=doc.id,
                    doc_tokens=doc.tokens,
                    remaining=remaining_tokens,
                )
                return False
            selected.append(ScoredDoc(doc=doc, score=score, reason=reason))
            used_ids.add(doc.id)
            remaining_tokens -= doc.tokens
            return True

        # ── Stage 1: always-priority docs (company brain) ─────────────────
        for doc in self.loader.by_priority("always"):
            _try_add(doc, "always")

        # ── Stage 2: department/vault docs ────────────────────────────────
        dept_docs = self.loader.by_vault(vault) if vault in self.loader.stats() else []
        for doc in dept_docs:
            if doc.priority in ("high", "normal"):
                _try_add(doc, f"dept:{vault}")

        # ── Stage 3: skill docs matching task keywords ────────────────────
        skill_count = 0
        skill_candidates: list[tuple[int, BrainDoc]] = []
        for doc in self.loader.by_vault("skills"):
            score = _score_doc(doc, keywords)
            if score > 0:
                skill_candidates.append((score, doc))
        skill_candidates.sort(key=lambda x: -x[0])

        for score, doc in skill_candidates:
            if skill_count >= max_skills:
                break
            if _try_add(doc, "skill:tag-match", score):
                skill_count += 1

        # ── Stage 4: normal-priority docs with keyword overlap ────────────
        for doc in self.loader.by_priority("normal"):
            if doc.vault == "skills":
                continue  # already handled in stage 3
            score = _score_doc(doc, keywords)
            if score > 0:
                _try_add(doc, "normal:tag-match", score)

        # ── Stage 5: low-priority docs (budget permitting) ────────────────
        for doc in self.loader.by_priority("low"):
            score = _score_doc(doc, keywords)
            if score > 0:
                _try_add(doc, "low:tag-match", score)

        log.info(
            "brain.selector.selected",
            department=department,
            vault=vault,
            docs=len(selected),
            tokens_used=max_tokens - remaining_tokens,
            tokens_budget=max_tokens,
            task_preview=task[:60],
        )

        return [s.doc for s in selected]


def _extract_keywords(text: str) -> set[str]:
    """Extract meaningful keywords from a task description."""
    stopwords = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "be", "this", "that",
        "it", "we", "you", "i", "me", "my", "our", "use", "using", "make",
        "create", "add", "get", "set", "run", "how", "what", "when", "where",
    }
    words = re.split(r"\W+", text.lower())
    return {w for w in words if len(w) > 2 and w not in stopwords}
