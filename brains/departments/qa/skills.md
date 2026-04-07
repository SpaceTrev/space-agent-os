---
type: department
subtype: skills
tags: [qa, skills]
created: "2026-04-06"
updated: "2026-04-06"
---

# QA Skills

## Test Execution
- Run `pnpm test` for TypeScript/Next.js unit and integration tests.
- Run `uv run pytest` for Python agent tests.
- Run `pnpm build` to validate no build-time errors.
- Interpret test output and identify root cause of failures.

## Code Review
- Review PRs for spec compliance: does the implementation satisfy all acceptance criteria?
- Check for obvious regressions in adjacent code.
- Verify TypeScript types in `packages/shared` are not broken.
- Confirm branch is up-to-date with `main` before approving.

## Manual Verification
- Test UI flows in `apps/dashboard` against acceptance criteria.
- Verify API endpoints return correct responses for happy path and edge cases.
- Check that new environment variables are documented.

## Reporting
- Write clear, actionable PR comments: what failed, why, what needs to change.
- Distinguish blocking issues (must fix) from suggestions (nice to fix).
- Update Linear issue status on approval and merge.

## Context
- Always read the Planning spec (Linear issue) before reviewing.
- Read the project brain for any decisions that affect review scope.
