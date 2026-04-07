---
type: meta
tags: [vault, conventions]
created: "2026-04-06"
updated: "2026-04-06"
---

# Space-Agent-OS Brain Vault

This Obsidian vault is the persistent memory layer for all Space-Agent-OS agents. Every agent reads from and writes to this vault as part of task execution.

## Vault Structure

```
brains/
  _templates/       — Note templates (project, person, daily, decision, research, department, meeting)
  company/           — Company-level context (mission, tech stack, brand)
  departments/       — Department brains (engineering, marketing, planning, qa)
  projects/          — Project-scoped context and specs
  people/            — Contact and team member profiles
  decisions/         — Architecture Decision Records (ADRs) and business decisions
  daily/             — Daily log notes (YYYY-MM-DD.md)
  research/          — Research notes, articles, technical deep-dives
  inbox/             — Unprocessed notes (triage into proper folders)
  VAULT.md           — This file. Vault conventions and schema reference.
```

## Frontmatter Schema

Every note MUST have YAML frontmatter with at minimum:

```yaml
---
type: project | person | daily | decision | research | department | meeting | meta
tags: []
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
---
```

### Type-Specific Fields

**project**: `status`, `priority`, `owner`, `team`
**person**: `role`, `company`, `email`, `phone`, `linkedin`
**decision**: `status`, `project`, `decided_by`, `date`
**research**: `topic`, `source`, `confidence`
**department**: `status`, `lead`, `members`
**meeting**: `date`, `attendees`, `project`
**daily**: `date`

## Linking Conventions

1. **Always use wikilinks**: `[[note-name]]` or `[[folder/note-name|Display Text]]`
2. **People links**: `[[people/trev]]`, `[[people/pablo]]`
3. **Project links**: `[[projects/space-agent-os/context]]`
4. **Decision links**: `[[decisions/YYYY-MM-DD-slug]]`
5. **Cross-reference liberally** — the graph is the value. When mentioning a person, project, or decision, link it.

## Agent Rules

1. **Read before write**: Always check if a note exists before creating a new one.
2. **Update `updated` field**: When modifying any note, bump the `updated` date in frontmatter.
3. **Inbox for unknowns**: If you're not sure where a note belongs, put it in `inbox/`.
4. **Daily notes are append-only**: Never rewrite a daily note — only append to sections.
5. **Decisions are immutable once decided**: If a decision is superseded, create a new decision note and link back. Set old status to `superseded`.
6. **Tags are lowercase, hyphenated**: `ai-agents`, `ground-control`, `go-to-market` — not `AI Agents`.

## Search (for agents)

Agents search the vault using `apps/core/tools/vault_search.py`:

```bash
# Search by content
python vault_search.py search "ground control deployment"

# Filter by type
python vault_search.py search --type project "railway"

# Filter by tag
python vault_search.py search --tag go-to-market ""

# List all notes of a type
python vault_search.py list --type decision

# Get backlinks for a note
python vault_search.py backlinks "projects/space-agent-os/context"

# Get a note's full content with resolved links
python vault_search.py read "people/trev"
```
