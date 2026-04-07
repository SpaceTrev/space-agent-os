"""
loader.py — Parse and index all brain/ vault documents.

Reads every .md file under BRAIN_ROOT, extracts YAML frontmatter, and returns
a list of BrainDoc objects. Documents missing required frontmatter fields are
skipped with a warning.

Environment:
    BRAIN_ROOT — path to the brain/ vault directory
                 (default: <repo_root>/brain)
"""
from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog
import yaml

log = structlog.get_logger()

# ─── Config ──────────────────────────────────────────────────────────────────

_REPO_ROOT = Path(__file__).parent.parent.parent.parent  # worktree root
_DEFAULT_BRAIN_ROOT = _REPO_ROOT / "brain"

BRAIN_ROOT: Path = Path(os.getenv("BRAIN_ROOT", str(_DEFAULT_BRAIN_ROOT)))

VAULT_ORDER = ["company", "engineering", "marketing", "sales", "operations", "skills"]
VALID_VAULTS = set(VAULT_ORDER)
VALID_PRIORITIES = {"always", "high", "normal", "low"}

# Rough chars-per-token ratio for Claude models
CHARS_PER_TOKEN: int = int(os.getenv("BRAIN_CHARS_PER_TOKEN", "4"))

# ─── Frontmatter parsing ──────────────────────────────────────────────────────

_FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """
    Split YAML frontmatter from body.

    Returns (frontmatter_dict, body_text).
    If no frontmatter found, returns ({}, text).
    """
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    try:
        fm: dict[str, Any] = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}, text
    body = text[m.end():]
    return fm, body


# ─── BrainDoc ─────────────────────────────────────────────────────────────────


@dataclass
class BrainDoc:
    """A parsed brain document ready for context injection."""

    # Required frontmatter
    id: str
    title: str
    vault: str
    priority: str  # always | high | normal | low

    # Optional frontmatter
    domain: str = ""
    tags: list[str] = field(default_factory=list)
    source: str = ""
    created: str = ""
    updated: str = ""

    # Derived
    path: Path = field(default_factory=Path)
    body: str = ""
    token_estimate: int = 0  # computed from body length if not in frontmatter

    @property
    def full_text(self) -> str:
        """Body text ready to inject into a context packet."""
        return self.body.strip()

    @property
    def tokens(self) -> int:
        """Estimated token count of the body."""
        return self.token_estimate or max(1, len(self.body) // CHARS_PER_TOKEN)

    @property
    def priority_rank(self) -> int:
        """Lower = higher priority (for sorting)."""
        return {"always": 0, "high": 1, "normal": 2, "low": 3}.get(self.priority, 99)

    def summary(self) -> str:
        return f"[{self.vault}/{self.id}] {self.title} (~{self.tokens}tok)"

    @classmethod
    def from_file(cls, path: Path) -> "BrainDoc | None":
        """
        Parse a markdown file into a BrainDoc.
        Returns None if required fields are missing or the file is not a valid doc.
        """
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            log.warning("brain.loader.read_error", path=str(path), error=str(exc))
            return None

        fm, body = _parse_frontmatter(text)

        # Validate required fields
        for field_name in ("id", "title", "vault", "priority"):
            if not fm.get(field_name):
                log.debug(
                    "brain.loader.skip_missing_field",
                    path=str(path),
                    missing=field_name,
                )
                return None

        vault = str(fm["vault"])
        priority = str(fm["priority"])

        if vault not in VALID_VAULTS:
            log.warning("brain.loader.invalid_vault", path=str(path), vault=vault)
            return None

        if priority not in VALID_PRIORITIES:
            log.warning("brain.loader.invalid_priority", path=str(path), priority=priority)
            return None

        tags = fm.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        raw_token_est = fm.get("token_estimate", 0)
        try:
            token_estimate = int(raw_token_est)
        except (TypeError, ValueError):
            token_estimate = 0

        return cls(
            id=str(fm["id"]),
            title=str(fm["title"]),
            vault=vault,
            priority=priority,
            domain=str(fm.get("domain", "")),
            tags=[str(t) for t in tags],
            source=str(fm.get("source", "")),
            created=str(fm.get("created", "")),
            updated=str(fm.get("updated", "")),
            path=path,
            body=body,
            token_estimate=token_estimate,
        )


# ─── BrainLoader ─────────────────────────────────────────────────────────────


class BrainLoader:
    """
    Loads and indexes all brain/ documents.

    Usage:
        loader = BrainLoader()          # scans BRAIN_ROOT once
        docs = loader.all_docs          # list[BrainDoc], sorted by priority
        company = loader.by_vault("company")
        skills  = loader.by_vault("skills")
        docs    = loader.by_tag("python")
    """

    def __init__(self, brain_root: Path = BRAIN_ROOT) -> None:
        self.brain_root = brain_root
        self._docs: list[BrainDoc] = []
        self._loaded_at: float = 0.0
        self._load()

    def _load(self) -> None:
        start = time.monotonic()
        docs: list[BrainDoc] = []

        if not self.brain_root.exists():
            log.warning("brain.loader.root_missing", path=str(self.brain_root))
            self._docs = []
            return

        for md_path in sorted(self.brain_root.rglob("*.md")):
            if md_path.name == "SCHEMA.md":
                continue  # schema is meta, not a brain doc
            doc = BrainDoc.from_file(md_path)
            if doc is not None:
                docs.append(doc)

        # Sort: priority_rank ASC, then vault order, then title
        vault_idx = {v: i for i, v in enumerate(VAULT_ORDER)}
        docs.sort(key=lambda d: (d.priority_rank, vault_idx.get(d.vault, 99), d.title))

        self._docs = docs
        self._loaded_at = time.monotonic()
        elapsed = round(time.monotonic() - start, 3)
        log.info(
            "brain.loader.ready",
            docs=len(docs),
            root=str(self.brain_root),
            elapsed_s=elapsed,
        )

    def reload(self) -> None:
        """Re-scan disk (call after brain docs are updated)."""
        self._load()

    @property
    def all_docs(self) -> list[BrainDoc]:
        return list(self._docs)

    def by_vault(self, vault: str) -> list[BrainDoc]:
        return [d for d in self._docs if d.vault == vault]

    def by_priority(self, priority: str) -> list[BrainDoc]:
        return [d for d in self._docs if d.priority == priority]

    def by_tag(self, tag: str) -> list[BrainDoc]:
        return [d for d in self._docs if tag in d.tags]

    def by_domain(self, domain: str) -> list[BrainDoc]:
        return [d for d in self._docs if d.domain == domain]

    def get(self, doc_id: str) -> BrainDoc | None:
        for doc in self._docs:
            if doc.id == doc_id:
                return doc
        return None

    def search(self, query: str) -> list[BrainDoc]:
        """
        Simple full-text search: scores docs by keyword overlap.
        Returns docs sorted by score (highest first), score > 0 only.
        """
        keywords = {w.lower() for w in re.split(r"\W+", query) if len(w) > 2}
        results: list[tuple[int, BrainDoc]] = []
        for doc in self._docs:
            score = _score_doc(doc, keywords)
            if score > 0:
                results.append((score, doc))
        results.sort(key=lambda x: -x[0])
        return [doc for _, doc in results]

    def stats(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for doc in self._docs:
            counts[doc.vault] = counts.get(doc.vault, 0) + 1
        return counts


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _score_doc(doc: BrainDoc, keywords: set[str]) -> int:
    """Return a relevance score for doc against a keyword set."""
    score = 0
    tag_words = {t.lower().replace("-", " ") for t in doc.tags}
    for kw in keywords:
        if any(kw in t for t in tag_words):
            score += 3
        if kw in doc.title.lower():
            score += 2
        if kw in doc.domain.lower():
            score += 2
        if kw in doc.body.lower():
            score += 1
    return score
