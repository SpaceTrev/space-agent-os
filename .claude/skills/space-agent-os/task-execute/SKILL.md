---
name: space-agent-os:task-execute
description: >
  Full end-to-end task execution cycle for space-agent-os. Use this skill whenever
  you are working on a Linear ticket — it enforces reading the ticket, branching
  correctly, doing the work, verifying it actually works, opening a PR, merging,
  confirming the commit landed on main, closing the Linear ticket, and updating
  brain files. ALWAYS use this skill when told to work on a SPA-XX ticket or any
  feature/fix for this project. Using it prevents the most common failure mode:
  reporting work as done without verifying it.
---

# Task Execution Cycle

Every unit of work in space-agent-os follows this cycle. Do not skip steps. If you
cannot complete a step, stop and report why — do not mark the task done and move on.

## Step 0 — Read the ticket

Before touching any code, read the Linear ticket:
- Use the Linear MCP (list_issues, get_issue) to fetch the full ticket description
- Extract: what needs to be built, acceptance criteria, any dependencies
- If the ticket is vague, note what you are assuming and surface it to the user

## Step 1 — Create branch

Branch name format: feat/SPA-XX-short-description (lowercase, hyphens, no spaces).

    git checkout main && git pull origin main
    git checkout -b feat/SPA-XX-your-description

Do NOT work directly on main. Do NOT reuse an old worktree branch.

## Step 2 — Do the work

Build what the ticket describes. Refer to relevant brain files for context:
- brains/company/ — mission, values, tech stack
- brains/departments/ — team context
- brains/projects/space-agent-os/ — project-specific patterns and decisions

## Step 3 — Verify the output is real

This step is not optional. Every category of work has a required verification:

**For file/code changes:**

    git status                          # show what changed
    git diff --stat HEAD                # confirm files were actually modified
    ls -la <path-to-created-files>      # confirm files exist

**For Node.js / Python services that should start:**

    npm run build 2>&1 | tail -20       # build must succeed

**For Railway deploys (see deploy-verify skill for full procedure):**

    curl -s -o /dev/null -w %{http_code} https://space-paperclip-production.up.railway.app/health
    # Must return 200. If not — do not proceed. Debug first.

If verification fails, fix it. Do not open a PR for broken work.

## Step 4 — Open PR

    gh pr create       --title "feat(SPA-XX): short description"       --body "Closes SPA-XX

## What
<what changed>

## Why
<why it matters>

## Verified
<paste actual output from Step 3 — not a placeholder>"       --base main       --head feat/SPA-XX-your-description

The PR body must include a Verified section with real output from Step 3.
No placeholder text. If you cannot fill it in, you skipped verification.

## Step 5 — Merge

    gh pr merge <PR-number> --squash --delete-branch

Only squash-merge to main. Delete the branch after merge.

## Step 6 — Confirm it landed

    git fetch origin
    git log origin/main --oneline -5

The merge commit must appear in git log origin/main. If it does not show up, the
merge did not work — do not proceed to ticket close.

## Step 7 — Close the Linear ticket

Use the Linear MCP to move the ticket to Done:

    save_issue(id: "SPA-XX", state: "Done")

## Step 8 — Update brain files

If your work introduced a new decision, pattern, or architectural choice that future
agents should know about, update the relevant brain file:
- brains/projects/space-agent-os/context.md — project-level decisions
- brains/departments/engineering/ — engineering patterns

Keep brain files current. They are the memory that persists across context windows.

---

## What done means

A task is Done when:
1. Code is on main (confirmed via git log origin/main)
2. Linear ticket is in Done state
3. Brain files updated if relevant
4. No broken builds or failing health checks

Anything short of this is in progress, not done.
