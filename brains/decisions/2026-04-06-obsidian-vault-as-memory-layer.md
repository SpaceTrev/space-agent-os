---
type: decision
status: decided
project: "[[projects/space-agent-os/context]]"
decided_by: [trev]
date: "2026-04-06"
tags: [architecture, brain, obsidian, memory]
created: "2026-04-06"
updated: "2026-04-06"
---

# Obsidian Vault as Agent Memory Layer

## Context
The `brains/` directory was plain markdown with no frontmatter, no linking conventions, and no search layer. As the brain grows to cover people, comms, research, and daily logs, we need structure that scales and is searchable by agents.

## Options Considered
1. **Keep plain markdown** — simple but no metadata, no search, no graph
2. **Database-backed memory (Postgres/SQLite)** — structured but loses human readability and Obsidian graph view
3. **Obsidian vault with frontmatter + wikilinks + CLI search** — human-editable, agent-searchable, graph-navigable
4. **Full RAG pipeline (vector DB)** — powerful search but non-deterministic, adds infra complexity

## Decision
Option 3 — convert `brains/` to an Obsidian vault. Add YAML frontmatter to all notes, use `[[wikilinks]]` for cross-references, build a Python CLI (`vault_search.py`) for agent queries. Supersedes [[decisions/2026-03-26-three-level-brain-system]] by extending it (the three-level loading still applies, now with better search on top).

## Consequences
- Agents can search by type, tag, content, and backlinks
- Human team members can browse the brain in Obsidian with graph view
- All notes follow a consistent frontmatter schema (enforced by templates)
- The vault is the single source of truth — replaces ad-hoc MEMORY.md approach
- Future option: add vector embeddings on top without changing the source files

## Related
- [[decisions/2026-03-26-three-level-brain-system]]
- [[people/trev]]
- [[projects/space-agent-os/context]]
