"""
cli.py — Space Scribe brain CLI.

Usage:
    python -m brain list [--vault VAULT] [--tag TAG] [--priority PRIORITY]
    python -m brain search <query>
    python -m brain show <doc-id>
    python -m brain add <vault> <title> [--file FILE] [--domain DOMAIN] [--tags t1,t2]
    python -m brain extract "<task>" --output-file FILE
    python -m brain stats

Examples:
    python -m brain list --vault engineering
    python -m brain list --tag python
    python -m brain search "async http retry"
    python -m brain show engineering-tech-stack
    python -m brain add skills "Git Branch Naming" --domain git --tags git,workflow
    python -m brain extract "Build brain module" --output-file /tmp/result.txt
    python -m brain stats
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

# Ensure apps/core is on sys.path when run directly
_CORE_DIR = Path(__file__).parent.parent
if str(_CORE_DIR) not in sys.path:
    sys.path.insert(0, str(_CORE_DIR))

from brain.loader import BRAIN_ROOT, VALID_PRIORITIES, VALID_VAULTS, BrainDoc, BrainLoader


# ─── Command handlers ─────────────────────────────────────────────────────────


def cmd_list(args: argparse.Namespace, loader: BrainLoader) -> int:
    docs = loader.all_docs

    if args.vault:
        if args.vault not in VALID_VAULTS:
            print(f"error: unknown vault '{args.vault}'. Valid: {', '.join(sorted(VALID_VAULTS))}")
            return 1
        docs = [d for d in docs if d.vault == args.vault]

    if args.tag:
        docs = [d for d in docs if args.tag in d.tags]

    if args.priority:
        docs = [d for d in docs if d.priority == args.priority]

    if not docs:
        print("No documents found.")
        return 0

    # Table header
    print(f"{'ID':<40} {'VAULT':<12} {'PRI':<8} {'TOKENS':<8} {'TITLE'}")
    print("-" * 100)
    for doc in docs:
        print(f"{doc.id:<40} {doc.vault:<12} {doc.priority:<8} {doc.tokens:<8} {doc.title}")

    print(f"\n{len(docs)} document(s)")
    return 0


def cmd_search(args: argparse.Namespace, loader: BrainLoader) -> int:
    query = " ".join(args.query)
    results = loader.search(query)

    if not results:
        print(f"No results for: {query!r}")
        return 0

    print(f"Results for {query!r} ({len(results)} found):\n")
    for doc in results:
        tags_str = ", ".join(doc.tags) if doc.tags else "—"
        print(f"  [{doc.vault}] {doc.id}")
        print(f"    {doc.title}")
        print(f"    tags: {tags_str}  |  ~{doc.tokens} tokens")
        print()
    return 0


def cmd_show(args: argparse.Namespace, loader: BrainLoader) -> int:
    doc = loader.get(args.id)
    if doc is None:
        print(f"error: no document with id '{args.id}'")
        return 1

    print(f"{'─' * 60}")
    print(f"  {doc.title}")
    print(f"  id:       {doc.id}")
    print(f"  vault:    {doc.vault}  |  priority: {doc.priority}")
    print(f"  domain:   {doc.domain or '—'}  |  tokens: ~{doc.tokens}")
    print(f"  tags:     {', '.join(doc.tags) or '—'}")
    print(f"  updated:  {doc.updated or '—'}")
    print(f"  path:     {doc.path}")
    print(f"{'─' * 60}")
    print()
    print(doc.full_text)
    return 0


def cmd_add(args: argparse.Namespace, loader: BrainLoader) -> int:
    vault = args.vault
    if vault not in VALID_VAULTS:
        print(f"error: unknown vault '{vault}'. Valid: {', '.join(sorted(VALID_VAULTS))}")
        return 1

    title = args.title
    domain = args.domain or vault
    tags = [t.strip() for t in (args.tags or "").split(",") if t.strip()]
    today = time.strftime("%Y-%m-%d", time.gmtime())

    # Generate slug from title
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    doc_id = f"{vault}-{slug}"

    # Get body from file or stdin
    if args.file:
        body = Path(args.file).read_text(encoding="utf-8")
    else:
        print("Enter document body (Ctrl+D to finish):")
        body = sys.stdin.read()

    tags_yaml = "\n".join(f"  - {t}" for t in tags) if tags else "  []"
    token_est = max(1, len(body) // 4)

    frontmatter = f"""\
---
id: {doc_id}
title: {title}
vault: {vault}
domain: {domain}
tags:
{tags_yaml}
priority: normal
created: {today}
updated: {today}
token_estimate: {token_est}
---

"""

    content = frontmatter + body.strip() + "\n"

    # Write to vault directory
    vault_dir = BRAIN_ROOT / vault
    vault_dir.mkdir(parents=True, exist_ok=True)
    out_path = vault_dir / f"{slug}.md"

    if out_path.exists() and not args.force:
        print(f"error: {out_path} already exists. Use --force to overwrite.")
        return 1

    out_path.write_text(content, encoding="utf-8")
    print(f"✓ Written: {out_path}")
    print(f"  id: {doc_id}  |  vault: {vault}  |  ~{token_est} tokens")

    loader.reload()
    return 0


def cmd_extract(args: argparse.Namespace) -> int:
    task = args.task

    if args.output_file:
        output = Path(args.output_file).read_text(encoding="utf-8")
    else:
        print("Enter task output (Ctrl+D to finish):")
        output = sys.stdin.read()

    async def _run() -> None:
        from brain.extractor import extract_from_task
        result = await extract_from_task(task, output)
        if result.extracted and result.skill:
            print(f"✓ Skill extracted: {result.skill.id}")
            print(f"  Title:  {result.skill.title}")
            print(f"  Domain: {result.skill.domain}")
            print(f"  Tags:   {', '.join(result.skill.tags)}")
            print(f"  Path:   {result.skill_path}")
        else:
            print(f"○ No skill extracted: {result.reason}")

    asyncio.run(_run())
    return 0


def cmd_stats(args: argparse.Namespace, loader: BrainLoader) -> int:
    stats = loader.stats()
    total = sum(stats.values())
    total_tokens = sum(d.tokens for d in loader.all_docs)

    print(f"Brain root: {BRAIN_ROOT}")
    print(f"Total docs: {total}  |  Total tokens: ~{total_tokens:,}")
    print()
    print(f"{'VAULT':<16} {'DOCS':<8} {'TOKENS'}")
    print("-" * 40)
    for vault in ["company", "engineering", "marketing", "sales", "operations", "skills"]:
        count = stats.get(vault, 0)
        tokens = sum(d.tokens for d in loader.by_vault(vault))
        print(f"{vault:<16} {count:<8} ~{tokens:,}")
    return 0


# ─── CLI entry point ──────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="brain",
        description="Space Scribe — brain vault CLI",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # list
    p_list = sub.add_parser("list", help="List brain documents")
    p_list.add_argument("--vault", help="Filter by vault")
    p_list.add_argument("--tag", help="Filter by tag")
    p_list.add_argument("--priority", choices=list(VALID_PRIORITIES), help="Filter by priority")

    # search
    p_search = sub.add_parser("search", help="Full-text search across brain docs")
    p_search.add_argument("query", nargs="+", help="Search terms")

    # show
    p_show = sub.add_parser("show", help="Show a document by ID")
    p_show.add_argument("id", help="Document ID (e.g. engineering-tech-stack)")

    # add
    p_add = sub.add_parser("add", help="Add a new brain document")
    p_add.add_argument("vault", choices=list(VALID_VAULTS), help="Target vault")
    p_add.add_argument("title", help="Document title")
    p_add.add_argument("--file", "-f", help="Read body from file (else stdin)")
    p_add.add_argument("--domain", "-d", help="Sub-domain (e.g. python, discord)")
    p_add.add_argument("--tags", "-t", help="Comma-separated tags")
    p_add.add_argument("--force", action="store_true", help="Overwrite existing file")

    # extract
    p_extract = sub.add_parser("extract", help="Extract a skill from a completed task")
    p_extract.add_argument("task", help="Task description")
    p_extract.add_argument("--output-file", "-o", help="File containing task output (else stdin)")

    # stats
    sub.add_parser("stats", help="Show vault statistics")

    args = parser.parse_args(argv)

    if args.command == "extract":
        return cmd_extract(args)

    loader = BrainLoader()

    cmd = args.command
    if cmd == "list":
        return cmd_list(args, loader)
    elif cmd == "search":
        return cmd_search(args, loader)
    elif cmd == "show":
        return cmd_show(args, loader)
    elif cmd == "add":
        return cmd_add(args, loader)
    elif cmd == "stats":
        return cmd_stats(args, loader)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
