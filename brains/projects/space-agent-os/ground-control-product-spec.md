---
type: project
subtype: spec
status: active
priority: high
owner: "trev"
team: [trev, pablo]
tags: [space-agent-os, spec, ground-control]
created: "2026-04-06"
updated: "2026-04-06"
---

# Ground Control — Product Spec

**Status:** Working name confirmed. Pre-deploy. Railway credentials pending.
**Owner:** [[people/trev]] + [[people/pablo]]
**Last updated:** 2026-04-01

---

## What Ground Control Is

Ground Control is an **agent-native operating system layer for teams**. It is not a generic task runner, not a chat UI wrapper, and not a workflow automation tool in the Zapier/Make sense.

The core premise: **every meaningful team workflow maps cleanly to an agent workflow**. The job of Ground Control is to make that mapping automatic.

A developer opens a Linear issue. An agent picks it up, works in a GitHub branch, opens a PR, triggers a QA pass, and when merged, closes the ticket — with no manual handoffs. That is the atomic unit of Ground Control.

Ground Control runs as a persistent process (not serverless). It listens for events from Linear webhooks and GitHub webhooks, routes them to the right agents, and maintains state in Postgres.

---

## How It Differs from Upstream Paperclip

Upstream `SpaceTrev/space-paperclip` is a general-purpose AI assistant framework with a pluggable tool system. Ground Control forks that and makes it opinionated:

- **Linear and GitHub are first-class, not plugins.** The task queue IS Linear. The code execution environment IS GitHub. These are not integrations that you configure — they are structural assumptions.
- **Brain-file context hydration is built-in.** Before any agent runs, the system loads relevant `brains/` files and injects them as context. Paperclip has no equivalent.
- **OpenClaw replaces direct Anthropic API calls.** All LLM traffic routes through the OpenClaw proxy, enabling token tracking, model swapping, and usage attribution per tenant.
- **Railway replaces Vercel.** Paperclip's persistent-process architecture is incompatible with serverless. Ground Control assumes a long-running Node process.

---

## Core Integrations

### Linear — Issues as Task Queue

Linear is the source of truth for work. Ground Control subscribes to Linear webhooks and treats every issue as a potential agent task.

**Routing logic:**
- Issue label `agent:code` → routes to code agent
- Issue label `agent:research` → routes to research agent
- Issue label `agent:qa` → routes to QA agent
- Issue label `agent:content` → routes to content/marketing agent
- No `agent:*` label → queued but not auto-dispatched (requires human assignment)

**Issue lifecycle:**
1. Issue created in Linear → webhook fires → Ground Control ingests
2. Routing label present → agent assigned, issue moved to `In Progress`
3. Agent opens GitHub branch (`feat/{TEAM}-{id}-{slug}`)
4. Agent completes work → PR opened → issue stays `In Progress`
5. PR merged → issue auto-closed via GitHub connector

**Config required:**
- `LINEAR_API_KEY` — Personal API token or OAuth app
- `LINEAR_WEBHOOK_SECRET` — for webhook verification
- `LINEAR_TEAM_ID` — team scope for issue queries

### GitHub — PRs as Agent Events

GitHub is the execution environment for all code work. Ground Control subscribes to repository webhooks and reacts to PR lifecycle events.

**Events handled:**
- `pull_request.opened` → triggers QA agent review
- `pull_request.merged` → closes related Linear ticket, triggers post-merge hooks
- `pull_request.closed` (without merge) → marks Linear issue as blocked/cancelled if applicable

**Branch naming convention (required):**
```
feat/{TEAM_PREFIX}-{LINEAR_ISSUE_ID}-{short-slug}
fix/{TEAM_PREFIX}-{LINEAR_ISSUE_ID}-{short-slug}
```
Example: `feat/SPA-92-github-connector`

The `{LINEAR_ISSUE_ID}` component is parsed by the GitHub connector to find and close the related Linear ticket on merge.

**Config required:**
- GitHub App (preferred) or Personal Access Token
- Webhook secret for payload verification
- Repository scope: `pull_requests`, `contents`, `issues`

### OpenClaw — Execution Layer

All LLM calls in Ground Control route through the OpenClaw gateway. This is a Claude Max API proxy that translates standard `openai`-compatible requests to Claude, enabling:

- Single credentials point (Claude Max subscription, not per-call billing)
- Token usage tracking per agent / per task
- Model swapping without changing agent code (swap at gateway level)
- Future: multi-tenant usage attribution

**Local:** `http://localhost:3456`
**Remote (Tailscale):** `http://100.102.161.30:3100`

OpenClaw is treated as always-available. Agents should fail loudly if OpenClaw is unreachable rather than falling back to direct API calls (which would bypass usage tracking).

### Brain Files — Context Hydration

Before any agent begins a task, Ground Control loads relevant brain files from the `brains/` directory and injects them into the agent's system prompt or context window.

**Directory structure:**
```
brains/
  projects/{project-name}/
    context.md         ← high-level project state and decisions
    *.md               ← specs, ADRs, reference docs
  global/
    conventions.md     ← cross-project coding standards
    personas.md        ← agent persona definitions
```

**Hydration rules:**
- All files under `brains/projects/{project-name}/` are loaded for tasks tagged with that project
- `brains/global/` files are always loaded
- Files are injected in order: global → project context → task-specific

This makes agents context-aware without requiring the user to paste context into every prompt.

---

## Key Workflow: Linear Issue → Merged PR → Closed Ticket

This is the atomic unit of Ground Control. Every other workflow is a variation.

```
1. Developer creates Linear issue
   └─ Labels: agent:code, project:space-agent-os

2. Linear webhook fires → Ground Control ingests issue
   └─ Routes to code agent based on label
   └─ Loads brain files for context hydration
   └─ Creates GitHub branch: feat/SPA-{id}-{slug}

3. Code agent works in branch
   └─ Commits code, pushes branch

4. Code agent opens PR
   └─ PR title references Linear issue: "feat: SPA-{id} — {description}"
   └─ GitHub webhook fires: pull_request.opened

5. GitHub connector handles pull_request.opened
   └─ Routes to QA agent
   └─ QA agent reviews diff, runs tests, posts review comment

6. Human (or auto-merge if QA passes) merges PR
   └─ GitHub webhook fires: pull_request.merged

7. GitHub connector handles pull_request.merged
   └─ Parses branch name → extracts SPA-{id}
   └─ Calls Linear API → closes issue
   └─ Posts merge summary comment to Linear issue
```

---

## Railway Deployment Architecture

Ground Control requires a persistent process — not serverless. Railway is the deployment target.

**Services:**
1. **ground-control** — Node.js persistent process
   - Listens on HTTP port for Linear + GitHub webhooks
   - Maintains in-memory event bus
   - Connects to Railway Postgres for state persistence
2. **ground-control-db** — Railway managed Postgres
   - Stores: task queue state, agent assignment log, webhook event log, token usage

**Environment variables (Railway):**
```
DATABASE_URL           — Railway Postgres connection string (auto-injected)
LINEAR_API_KEY
LINEAR_WEBHOOK_SECRET
LINEAR_TEAM_ID
GITHUB_APP_ID
GITHUB_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
OPENCLAW_BASE_URL      — http://... (internal or Tailscale)
OPENCLAW_API_KEY
```

**Pending — required before first deploy:**
- Railway project name (from [[people/trev]])
- Railway API credentials / CLI token (from [[people/trev]])
- GitHub App creation and private key
- Linear webhook endpoint configuration (needs Railway URL first)

---

## What Is NOT in Scope (v1)

- Multi-tenant / per-client isolation (v1 is single-tenant: Trev + Pablo's team)
- Workflow builder UI (NL-defined workflows come later)
- WhatsApp / SMS triggers (Discord is the human-in-the-loop channel for v1)
- Billing / usage metering exposed to end users (internal tracking only)
- Any Vercel deployment (non-starter — persistent process required)
