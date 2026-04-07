#!/usr/bin/env python3
"""
vault_search.py — CLI search tool for the Space-Agent-OS Obsidian brain vault.

Agents call this to query the vault by content, frontmatter type/tags,
and wikilink backlinks. No external dependencies — stdlib only.

Usage:
    python vault_search.py search "query"                     # Full-text search
    python vault_search.py search --type project "query"      # Filter by type
    python vault_search.py search --tag go-to-market "query"  # Filter by tag
    python vault_search.py list --type decision               # List all notes of a type
    python vault_search.py read "people/trev"                 # Read a note with metadata
    python vault_search.py backlinks "people/trev"            # Find notes linking to this one
    python vault_search.py tags                               # List all tags in the vault
    python vault_search.py types                              # List all note types
    python vault_search.py recent --days 7                    # Recently modified notes
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

VAULT_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "brains"
IGNORED_DIRS = {".obsidian", "_attachments", ".trash", ".git"}
NOTE_EXT = ".md"

# ---------------------------------------------------------------------------
# Frontmatter parser (no pyyaml dependency)
# ---------------------------------------------------------------------------

_FM_DELIM = "---"


def parse_frontmatter(text: str) -> dict[str, Any]:
    """Parse YAML frontmatter from markdown text. Handles simple key: value pairs,
    lists (both inline [a, b] and block - items), and quoted strings."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != _FM_DELIM:
        return {}

    end = -1
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == _FM_DELIM:
            end = i
            break
    if end == -1:
        return {}

    fm: dict[str, Any] = {}
    current_key: str | None = None

    for line in lines[1:end]:
        # Skip empty lines and comments
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Block list item (  - value)
        if stripped.startswith("- ") and current_key is not None:
            val = stripped[2:].strip().strip("\"'")
            if not isinstance(fm.get(current_key), list):
                fm[current_key] = []
            fm[current_key].append(val)
            continue

        # Key: value pair
        if ":" in line:
            colon_idx = line.index(":")
            key = line[:colon_idx].strip()
            raw_val = line[colon_idx + 1 :].strip()
            current_key = key

            # Strip inline comments (but not inside quotes)
            if raw_val and not raw_val.startswith('"') and "#" in raw_val:
                raw_val = raw_val[: raw_val.index("#")].strip()

            # Empty value — might be followed by block list
            if not raw_val:
                fm[key] = ""
                continue

            # Inline list [a, b, c]
            if raw_val.startswith("[") and raw_val.endswith("]"):
                items = raw_val[1:-1].split(",")
                fm[key] = [i.strip().strip("\"'") for i in items if i.strip()]
                continue

            # Quoted string
            if (raw_val.startswith('"') and raw_val.endswith('"')) or (
                raw_val.startswith("'") and raw_val.endswith("'")
            ):
                fm[key] = raw_val[1:-1]
                continue

            # Boolean / number / plain string
            if raw_val.lower() in ("true", "false"):
                fm[key] = raw_val.lower() == "true"
            elif raw_val.replace(".", "", 1).replace("-", "", 1).isdigit():
                fm[key] = float(raw_val) if "." in raw_val else int(raw_val)
            else:
                fm[key] = raw_val

    return fm


# ---------------------------------------------------------------------------
# Note model
# ---------------------------------------------------------------------------


@dataclass
class Note:
    path: Path  # Relative to VAULT_ROOT
    frontmatter: dict[str, Any] = field(default_factory=dict)
    body: str = ""
    _raw: str = ""

    @property
    def name(self) -> str:
        return self.path.stem

    @property
    def note_type(self) -> str:
        return str(self.frontmatter.get("type", "unknown"))

    @property
    def tags(self) -> list[str]:
        t = self.frontmatter.get("tags", [])
        return t if isinstance(t, list) else [t] if t else []

    @property
    def title(self) -> str:
        # First H1 heading, or filename
        for line in self.body.split("\n"):
            if line.startswith("# "):
                return line[2:].strip()
        return self.name

    @property
    def wikilinks(self) -> list[str]:
        """Extract all [[target]] or [[target|alias]] links from body."""
        return re.findall(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", self._raw)

    def matches_query(self, query: str) -> bool:
        if not query:
            return True
        q = query.lower()
        return q in self._raw.lower() or q in self.name.lower()

    def matches_type(self, note_type: str | None) -> bool:
        if not note_type:
            return True
        return self.note_type == note_type

    def matches_tag(self, tag: str | None) -> bool:
        if not tag:
            return True
        return tag.lower() in [t.lower() for t in self.tags]

    def summary(self) -> dict[str, Any]:
        return {
            "path": str(self.path),
            "title": self.title,
            "type": self.note_type,
            "tags": self.tags,
            "updated": self.frontmatter.get("updated", ""),
        }


# ---------------------------------------------------------------------------
# Vault loader
# ---------------------------------------------------------------------------


def iter_notes(vault: Path = VAULT_ROOT) -> list[Note]:
    """Load all markdown notes from the vault."""
    notes: list[Note] = []
    for root, dirs, files in os.walk(vault):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for fname in files:
            if not fname.endswith(NOTE_EXT):
                continue
            # Skip templates
            rel = Path(root).relative_to(vault) / fname
            if str(rel).startswith("_templates"):
                continue

            full_path = Path(root) / fname
            try:
                raw = full_path.read_text(encoding="utf-8")
            except Exception:
                continue

            fm = parse_frontmatter(raw)

            # Body = everything after second ---
            body = raw
            lines = raw.split("\n")
            if lines and lines[0].strip() == _FM_DELIM:
                for i, line in enumerate(lines[1:], start=1):
                    if line.strip() == _FM_DELIM:
                        body = "\n".join(lines[i + 1 :])
                        break

            notes.append(
                Note(path=rel, frontmatter=fm, body=body.strip(), _raw=raw)
            )
    return notes


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_search(args: argparse.Namespace) -> None:
    """Search notes by content, optionally filtered by type/tag."""
    notes = iter_notes()
    results = [
        n
        for n in notes
        if n.matches_query(args.query)
        and n.matches_type(args.type)
        and n.matches_tag(args.tag)
    ]

    if not results:
        print(json.dumps({"results": [], "count": 0}))
        return

    # Sort by updated date (most recent first), then by relevance
    def sort_key(n: Note) -> str:
        return n.frontmatter.get("updated", "0000-00-00")

    results.sort(key=sort_key, reverse=True)

    output = {
        "results": [n.summary() for n in results[: args.limit]],
        "count": len(results),
        "truncated": len(results) > args.limit,
    }
    print(json.dumps(output, indent=2))


def cmd_list(args: argparse.Namespace) -> None:
    """List all notes, optionally filtered by type."""
    notes = iter_notes()
    results = [n for n in notes if n.matches_type(args.type) and n.matches_tag(args.tag)]
    results.sort(key=lambda n: n.frontmatter.get("updated", ""), reverse=True)

    output = {
        "results": [n.summary() for n in results],
        "count": len(results),
    }
    print(json.dumps(output, indent=2))


def cmd_read(args: argparse.Namespace) -> None:
    """Read a specific note by path (without .md extension)."""
    note_path = args.note_path
    if not note_path.endswith(".md"):
        note_path += ".md"

    full = VAULT_ROOT / note_path
    if not full.exists():
        # Try case-insensitive search
        for note in iter_notes():
            if str(note.path).lower() == note_path.lower():
                full = VAULT_ROOT / note.path
                break

    if not full.exists():
        print(json.dumps({"error": f"Note not found: {note_path}"}))
        sys.exit(1)

    raw = full.read_text(encoding="utf-8")
    fm = parse_frontmatter(raw)
    print(json.dumps({"path": note_path, "frontmatter": fm, "content": raw}, indent=2))


def cmd_backlinks(args: argparse.Namespace) -> None:
    """Find all notes that link to the given note path."""
    target = args.note_path.replace(".md", "")
    target_name = Path(target).stem

    notes = iter_notes()
    results = []
    for note in notes:
        links = note.wikilinks
        for link in links:
            # Match full path or just the filename
            if link == target or link == target_name or link.endswith("/" + target_name):
                results.append(note.summary())
                break

    output = {
        "target": target,
        "backlinks": results,
        "count": len(results),
    }
    print(json.dumps(output, indent=2))


def cmd_tags(args: argparse.Namespace) -> None:
    """List all unique tags in the vault with counts."""
    notes = iter_notes()
    tag_counts: dict[str, int] = {}
    for note in notes:
        for tag in note.tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
    print(json.dumps({"tags": dict(sorted_tags), "total": len(sorted_tags)}, indent=2))


def cmd_types(args: argparse.Namespace) -> None:
    """List all note types in the vault with counts."""
    notes = iter_notes()
    type_counts: dict[str, int] = {}
    for note in notes:
        t = note.note_type
        type_counts[t] = type_counts.get(t, 0) + 1

    print(json.dumps({"types": type_counts}, indent=2))


def cmd_recent(args: argparse.Namespace) -> None:
    """List notes modified in the last N days (by filesystem mtime)."""
    cutoff = datetime.now() - timedelta(days=args.days)
    notes = iter_notes()
    results = []
    for note in notes:
        full = VAULT_ROOT / note.path
        mtime = datetime.fromtimestamp(full.stat().st_mtime)
        if mtime >= cutoff:
            s = note.summary()
            s["mtime"] = mtime.isoformat()
            results.append(s)

    results.sort(key=lambda x: x["mtime"], reverse=True)
    print(json.dumps({"results": results, "count": len(results), "since": cutoff.isoformat()}, indent=2))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Search the Space-Agent-OS Obsidian brain vault"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # search
    p_search = sub.add_parser("search", help="Full-text search with optional filters")
    p_search.add_argument("query", nargs="?", default="", help="Search query")
    p_search.add_argument("--type", "-t", help="Filter by note type")
    p_search.add_argument("--tag", "-g", help="Filter by tag")
    p_search.add_argument("--limit", "-l", type=int, default=20, help="Max results")
    p_search.set_defaults(func=cmd_search)

    # list
    p_list = sub.add_parser("list", help="List notes with optional type/tag filter")
    p_list.add_argument("--type", "-t", help="Filter by note type")
    p_list.add_argument("--tag", "-g", help="Filter by tag")
    p_list.set_defaults(func=cmd_list)

    # read
    p_read = sub.add_parser("read", help="Read a specific note")
    p_read.add_argument("note_path", help="Note path relative to vault (e.g. people/trev)")
    p_read.set_defaults(func=cmd_read)

    # backlinks
    p_back = sub.add_parser("backlinks", help="Find notes linking to a given note")
    p_back.add_argument("note_path", help="Target note path")
    p_back.set_defaults(func=cmd_backlinks)

    # tags
    p_tags = sub.add_parser("tags", help="List all tags with counts")
    p_tags.set_defaults(func=cmd_tags)

    # types
    p_types = sub.add_parser("types", help="List all note types with counts")
    p_types.set_defaults(func=cmd_types)

    # recent
    p_recent = sub.add_parser("recent", help="Recently modified notes")
    p_recent.add_argument("--days", "-d", type=int, default=7, help="Lookback window in days")
    p_recent.set_defaults(func=cmd_recent)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
