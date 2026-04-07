---
type: department
subtype: dependencies
tags: [engineering, dependencies]
created: "2026-04-06"
updated: "2026-04-06"
---

# Engineering Dependencies

## Needs from Upstream (Planning)
- Feature description — what is being built and why.
- Acceptance criteria — specific, testable conditions for "done".
- Affected files or modules — where changes are expected (Planning's best guess).
- Linear issue ID — for branch naming and PR linking.

Engineering cannot start without a spec. If no spec exists, create a minimal one and get [[departments/planning/README]] to confirm before writing code.

## Delivers Downstream (QA)
- A branch pushed to origin with all changes committed.
- An open PR on GitHub with:
  - Title referencing the Linear issue.
  - Description summarizing what changed and why.
  - List of files modified.
- Updated project brain with any decisions or trade-offs made.
- Linear issue moved to "In Review".
- A notification to QA (via Discord or Linear comment) that the PR is ready.

## Shared Contracts
- TypeScript types in `packages/shared` are the API contract between `apps/dashboard` and `apps/core`. Engineering must not break these without coordinating with QA and Planning.
