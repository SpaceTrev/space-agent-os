---
id: skills-index
title: Skills Vault Index
vault: skills
domain: meta
tags:
  - index
  - skills
priority: normal
created: 2026-04-06
updated: 2026-04-06
token_estimate: 150
---

# Skills Vault

This vault holds reusable patterns extracted from completed agent tasks.

## How Skills Are Created

1. **Automatic**: `apps/core/brain/extractor.py` runs after every task and
   asks the LLM to extract a reusable pattern. If found, it writes a skill doc here.

2. **Manual**: Create a `.md` file following `brain/SCHEMA.md`. Use `vault: skills`.

## Naming Convention

```
brain/skills/<domain>-<pattern-slug>.md
```

Examples:
- `brain/skills/python-async-httpx-retry.md`
- `brain/skills/discord-embed-formatting.md`
- `brain/skills/git-branch-naming.md`

## Skill Doc Template

```markdown
---
id: skills-<domain>-<slug>
title: <Pattern Name>
vault: skills
domain: <domain>
tags: [tag1, tag2]
priority: normal
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

## Pattern

When: <situation that triggers this skill>

## Steps

1. ...
2. ...

## Example

\`\`\`python
# minimal illustrative snippet
\`\`\`

## Antipatterns

- Don't: ...
```

## Loading Rules

Skills are loaded by the assembler when skill `tags` intersect the task's
inferred keyword set. Max 5 skills per context packet (token budget).
