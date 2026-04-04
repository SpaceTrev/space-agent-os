---
name: space-agent-os:pr-flow
description: >
  PR creation, merge, and Linear ticket close loop for space-agent-os. Use this
  skill whenever creating a PR, merging a branch, or closing out a Linear ticket
  after a merge. It enforces that the merge actually lands on main (confirmed via
  git log) and the Linear ticket actually transitions to Done (not just I tried).
  Always use this skill when told to open a PR, merge this, or close the ticket.
---

# PR Flow

## Before opening a PR

Confirm the branch is ready:

    git status                                  # should be clean
    git log origin/main..HEAD --oneline         # shows your commits not yet on main

If git log origin/main..HEAD is empty, your work is not on this branch — stop.

## Open the PR

    gh pr create       --title "type(SPA-XX): description under 72 chars"       --body "## What changed
<concise description>

## Why
<link to Linear ticket or brief rationale>

## Verified
<paste actual verification output — not a placeholder>

Closes SPA-XX"       --base main

Title format: type(SPA-XX): description
Types: feat, fix, chore, docs, refactor

## Check for conflicts

    gh pr view <number> --json mergeable,mergeStateStatus

- mergeable: true + mergeStateStatus: CLEAN = ready to merge
- If there are conflicts, resolve them on the branch before merging

## Merge

    gh pr merge <number> --squash --delete-branch

Always squash-merge. Always delete the branch after merge.

## Confirm the commit landed

This is the most commonly skipped and most important step:

    git fetch origin
    git log origin/main --oneline -3

The squash commit message should match your PR title. If it is not there, the merge
failed — check gh pr view <number> to see the actual state.

## Close the Linear ticket

After confirming the merge is on main, use the Linear MCP:

    save_issue(id: "SPA-XX", state: "Done")

Do not skip this because it is probably fine. Verify it moved to Done.

## What done looks like

    PR #4 merged (squash)
    git log origin/main -> "feat(SPA-92): implement X  abc1234"
    Linear SPA-92 -> Done
    Branch feat/SPA-92-implement-x deleted

Every line confirmed, not assumed.
