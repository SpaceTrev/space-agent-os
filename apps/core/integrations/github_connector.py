# TODO: Wire up before this module is usable:
#   - Create GitHub App (preferred) or generate a Personal Access Token with:
#       repo, pull_requests, issues scopes
#   - Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY (or GITHUB_TOKEN) in apps/core/.env
#   - Set GITHUB_WEBHOOK_SECRET in apps/core/.env
#   - Register a webhook endpoint in the GitHub repo/org settings pointing at
#       POST /webhooks/github  (needs a public URL — Railway deploy or ngrok for local dev)
#   - Wire the webhook handler into the FastAPI/Starlette app in apps/core/
#   - Import and call GitHubConnector from the event router
#   - Ensure LINEAR_API_KEY is set (used by on_pr_merged to close tickets)

from __future__ import annotations

import re
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

# Branch naming convention: feat/{TEAM_PREFIX}-{LINEAR_ISSUE_ID}-{slug}
# Example: feat/SPA-92-github-connector
_BRANCH_ISSUE_RE = re.compile(r"(?:feat|fix|chore|docs)/[A-Z]+-(\d+)-", re.IGNORECASE)


@dataclass
class PREvent:
    """Parsed subset of a GitHub pull_request webhook payload."""

    action: str          # "opened" | "closed" | "merged"
    pr_number: int
    pr_title: str
    head_branch: str
    repo_full_name: str  # "owner/repo"
    merged: bool


class GitHubConnector:
    """
    Handles GitHub pull request webhook events and bridges them to the
    Ground Control agent task system and Linear issue tracker.

    This is a scaffold — method bodies contain the intended logic and
    integration points but are not yet fully implemented.
    """

    def __init__(
        self,
        github_token: str,
        linear_api_key: str,
        linear_team_id: str,
        openclaw_base_url: str = "http://localhost:3456",
    ) -> None:
        self._github_headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._linear_headers = {
            "Authorization": linear_api_key,
            "Content-Type": "application/json",
        }
        self._linear_team_id = linear_team_id
        self._openclaw_base_url = openclaw_base_url

    # ------------------------------------------------------------------
    # Public event handlers — called by the webhook router
    # ------------------------------------------------------------------

    async def on_pr_opened(self, event: PREvent) -> None:
        """
        Triggered when a pull request is opened against the repository.

        Intended behaviour:
          1. Parse the head branch name to extract the Linear issue ID (if present).
          2. Enqueue a QA agent task: the agent will review the diff, run the
             test suite via agent_mcp, and post a structured review comment on
             the PR.
          3. Optionally update the Linear issue status to "In Review".

        The QA task is dispatched to the OpenClaw execution layer with the PR
        diff URL and the hydrated brain-file context for the relevant project.
        """
        logger.info("PR opened: #%s — %s", event.pr_number, event.pr_title)
        issue_id = _extract_linear_issue_id(event.head_branch)

        # TODO: dispatch QA agent task via orchestrator/task queue
        # TODO: post "QA agent assigned" comment to PR via GitHub API
        # TODO: if issue_id, update Linear issue status to "In Review"
        _ = issue_id  # suppress unused-variable lint until wired

    async def on_pr_merged(self, event: PREvent) -> None:
        """
        Triggered when a pull request is merged (closed with merged=True).

        Intended behaviour:
          1. Parse the head branch name to extract the Linear issue ID.
          2. Call the Linear API to mark the issue as completed/done.
          3. Post a brief merge summary comment to the Linear issue thread,
             linking back to the merged PR.
          4. Trigger any post-merge hooks (e.g. deploy pipeline notification).

        If no Linear issue ID can be parsed from the branch name, the merge
        is logged but no Linear update is attempted.
        """
        logger.info("PR merged: #%s — %s", event.pr_number, event.pr_title)
        issue_id = _extract_linear_issue_id(event.head_branch)

        if not issue_id:
            logger.warning(
                "on_pr_merged: could not extract Linear issue ID from branch %r — "
                "no ticket will be closed. Check branch naming convention.",
                event.head_branch,
            )
            return

        logger.info("Closing Linear issue %s (PR #%s merged)", issue_id, event.pr_number)
        await _close_linear_issue(
            issue_id=issue_id,
            pr_number=event.pr_number,
            repo=event.repo_full_name,
            headers=self._linear_headers,
        )

    async def on_pr_closed(self, event: PREvent) -> None:
        """
        Triggered when a pull request is closed WITHOUT being merged.

        Intended behaviour:
          1. Parse the head branch name for a Linear issue ID.
          2. If found, add a comment to the Linear issue noting the PR was
             closed unmerged, and optionally move the issue back to "To Do"
             or "Blocked" depending on close reason.
          3. Log the event for audit trail.

        This is the unhappy path — a PR closed without merge usually indicates
        the work was abandoned, superseded, or needs rework.
        """
        logger.info(
            "PR closed (unmerged): #%s — %s on branch %r",
            event.pr_number,
            event.pr_title,
            event.head_branch,
        )
        issue_id = _extract_linear_issue_id(event.head_branch)

        # TODO: post comment to Linear issue noting PR closed unmerged
        # TODO: optionally revert Linear issue status to "To Do" or "Blocked"
        _ = issue_id


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _extract_linear_issue_id(branch_name: str) -> str | None:
    """
    Extract a Linear issue ID from a branch name following the convention:
        feat/{TEAM_PREFIX}-{ISSUE_NUMBER}-{slug}

    Returns the full issue identifier string (e.g. "SPA-92") or None if
    no match is found.

    Examples:
        "feat/SPA-92-github-connector" → "SPA-92"
        "fix/GRD-14-auth-bug"         → "GRD-14"
        "main"                         → None
    """
    # Re-extract the team prefix + number together
    full_match = re.search(
        r"(?:feat|fix|chore|docs)/([A-Z]+-\d+)-", branch_name, re.IGNORECASE
    )
    if full_match:
        return full_match.group(1).upper()
    return None


async def _close_linear_issue(
    issue_id: str,
    pr_number: int,
    repo: str,
    headers: dict[str, str],
) -> None:
    """
    Close a Linear issue by its identifier (e.g. "SPA-92") using the
    Linear GraphQL API.

    Queries for the issue UUID by identifier, then mutates its state to
    the team's "Done" state.

    TODO: This currently assumes a single team. Make team_id configurable
    if Ground Control expands to multi-team setups.
    """
    # TODO: implement — requires two GraphQL calls:
    #   1. query Issue(identifier: $id) { id state { id } team { states { id name } } }
    #   2. mutation UpdateIssue(id: $uuid, stateId: $doneStateId) { ... }
    # Reference: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
    async with httpx.AsyncClient() as client:
        # Placeholder — log intent until fully implemented
        logger.info(
            "_close_linear_issue: would close %s via Linear API "
            "(triggered by merge of PR #%s in %s)",
            issue_id,
            pr_number,
            repo,
        )
        _ = client  # suppress lint until GraphQL calls are wired
