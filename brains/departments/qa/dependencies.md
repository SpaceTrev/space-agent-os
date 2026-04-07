---
type: department
subtype: dependencies
tags: [qa, dependencies]
created: "2026-04-06"
updated: "2026-04-06"
---

# QA Dependencies

## Needs from Upstream (Engineering)
- An open PR on GitHub with a description linking to the Linear issue.
- All automated tests passing (or a clear note explaining known failures and why they're acceptable).
- Updated project brain if implementation decisions deviate from the original spec.
- Linear issue in "In Review" status.

QA should not begin review until [[departments/engineering/README]] has explicitly signaled readiness.

## Delivers Downstream (Merge / Done)
- PR approval and merge (or rejection with specific feedback).
- Linear issue transitioned to "Done" after successful merge.
- Notification to Planning/humans of completion via Discord or Linear comment.
- Any recurring QA patterns written to the project brain for future reference.

## Shared Contracts
- QA is not a rewrite gate — it verifies against the spec, not personal preference.
- If the spec is wrong, QA escalates to [[departments/planning/README]] rather than rejecting [[departments/engineering/README]]'s work.
- QA does not merge to `main` without all tests passing unless [[departments/planning/README]] explicitly approves an exception.
