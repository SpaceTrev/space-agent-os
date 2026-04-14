# Space Agent OS — Build Sessions Changelog & Status

**Period:** April 7–13, 2026
**Repository:** [SpaceTrev/space-agent-os](https://github.com/SpaceTrev/space-agent-os)
**PRs Merged:** 29+

---

## 1. Architecture Decisions

### OpenClaw Deprecated → CentralBrain + SpaceRuntime

OpenClaw has been fully deprecated. The replacement stack is **CentralBrain** (multi-model fallback orchestrator) paired with a custom-designed **SpaceRuntime** engine. Paperclip was evaluated and retained as a reference only — all orchestration is custom-built.

### Multi-Model Orchestration

The system uses a tiered model strategy to balance cost, speed, and capability:

| Tier | Model | Role | Cost | Performance |
|------|-------|------|------|-------------|
| Real-time local | qwen3-coder:30b | Live coding, fast tasks | FREE (Ollama) | 25–35 tok/s |
| Async brain | gemma4:31b | Background reasoning, brain ops | FREE (Ollama) | 9–11 tok/s |
| Orchestrator | Claude Opus 4.6 | Top-level orchestration, planning | API credits | — |
| Code muscle | ChatGPT 5.4 Codex | Heavy code gen via Harness | GPT Pro sub | — |
| Task muscle | Sonnet, Haiku, GPT 5.3, Kimi, MiniMax, Gemini | Cheap bulk tasks | Low-cost API | — |

CentralBrain implements a fallback chain: `claude_max → anthropic → gemini → ollama`. If the top-tier model is unavailable or rate-limited, the system cascades down automatically.

### Hybrid Brain — 3-Tier Memory

Memory is structured in three tiers for speed-vs-depth tradeoffs:

1. **Hot layer:** Markdown files in the brain vault — instant context injection, human-readable, version-controlled
2. **Warm layer:** sqlite-vec + FTS5 — vector similarity search and full-text search for medium-depth recall
3. **Cold layer:** Archive — long-term storage for historical context, rarely accessed

### Supabase Poll-Out Sync

The sync architecture is strictly **push-out only** from the Mac. No inbound connections to the local machine, keeping the setup secure behind NAT/firewall.

- `push_state.py` — Mac pushes state to Supabase every 10 seconds
- `poll_commands.py` — Mac polls Supabase for pending commands
- `run_sync.py` — Combined sync runner
- 4 Supabase tables with Row Level Security (RLS) enabled
- Supabase project: `qsdtnnutusvkgnvnubxd`
- Dashboard reads FROM Supabase (never writes to local)

### SpaceRuntime Design

The custom runtime engine was designed with the following components:

- **Core loop:** Event-driven task processing cycle
- **Tool registry:** Dynamic registration and discovery of agent tools
- **Model router:** Routes tasks to the appropriate model tier based on requirements
- **Session management:** Tracks agent sessions, context windows, and state
- **Plugin system:** Extensible architecture for adding capabilities
- **12-week build plan:** Phased rollout from core loop through full marketplace integration

---

## 2. Product Vision — Space Agent OS / FAM (Flywheel Automation Marketplace)

### Core Concept

An all-in-one autonomous workforce platform. The marketplace sells agents, skills, automations, scripts, workflows, and integrations. **Agent templates are the primary product** — think apps in an app store, but each "app" is an autonomous agent or automation.

### The Flywheel

Every task the system performs feeds the flywheel:

```
Task executed → Skill extracted → Marketplace item created → Library grows → System compounds
```

Every client engagement produces reusable marketplace items. The library gets richer with every interaction.

### Service Tiers

| Tier | Description | Target |
|------|-------------|--------|
| Self-serve | Browse marketplace, install agents, configure via UI | SMBs, solopreneurs |
| Configured | Pre-configured agent bundles, onboarding support | Mid-market |
| Custom enterprise | Bespoke agent development, dedicated support | Enterprise |

### UI Philosophy — Two-Depth Design

- **Simple mode:** A dentist can hire an agent in 3 clicks
- **Deep mode:** An engineer can configure model routing, memory tiers, and tool chains

### AI Tool Aggregator Portal

Surfaces existing free AI tools alongside custom agents in a unified interface: Google Stitch, Figma Make, Perplexity, NotebookLM, and others. Positions Space Agent OS as the dashboard for ALL AI tools, not just custom ones.

### Mexico-First Go-to-Market

- Bilingual (Spanish/English) from day one
- SAT/CFDI tax compliance built in
- Peso pricing
- Targeting underserved LATAM market for AI automation

### Revenue Model

- **SaaS subscriptions:** Monthly/annual platform access
- **Marketplace revenue share:** 70/30 split (creator/platform)
- **Consulting:** Custom agent development and enterprise integration

---

## 3. What Was Built

### Brain Vault (Space Scribe)

- 6 domain vaults covering core knowledge areas
- 24 documents authored and indexed
- `SCHEMA.md` defining vault structure and conventions
- Context injection module for feeding relevant vault docs into agent prompts
- Brain CLI for command-line vault operations
- Python module (`brain/`) for programmatic access

### Local Model Infrastructure

- Gemma 4 31B installed on Ollama, benchmarked at 9–11 tok/s on M4 Pro 48GB
- 13 models total available on Ollama
- qwen3-coder:30b confirmed at 25–35 tok/s for real-time use

### CentralBrain Orchestrator

- Multi-model fallback chain: `claude_max → anthropic → gemini → ollama`
- Automatic cascade on rate limits or unavailability
- Discord bot wired to CentralBrain with heartbeat monitoring

### FastAPI Backend

Endpoints implemented:

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | System health check |
| `GET /agents` | List registered agents |
| `GET /tasks` | List tasks and status |
| `GET /models` | Available models and their status |
| `POST /dispatch` | Dispatch a task to an agent |

### Supabase Sync Layer

- `push_state.py` — Outbound state sync (10s interval)
- `poll_commands.py` — Inbound command polling
- `run_sync.py` — Combined sync orchestrator
- 4 tables with RLS policies
- Zero inbound connections to local machine

### Dashboard (Vercel)

- **Mission Control:** System overview, agent status, health metrics
- **Marketplace:** 15 items listed (agents, skills, automations)
- **Dispatch Console:** Send tasks to agents, view results
- **Navigation component** with mobile hamburger menu
- Agent orchestration dashboard built in Next.js
- Auto-deploys from GitHub on push to main

### Developer Experience

- `boot.sh` — One-command startup for the entire stack
- Tier 2 deep storage operational (sqlite-vec + FTS5)
- 29 PRs merged to main with CodeRabbit review on each

---

## 4. Architecture Documentation Created

| Document | Scope |
|----------|-------|
| Multi-model orchestration architecture | Model tiers, routing logic, fallback chains |
| Hybrid brain architecture (3-tier) | Hot/warm/cold memory layers, query flow |
| SpaceRuntime architecture | Core loop, tool registry, model router, plugin system |
| Automation Marketplace architecture | 16 sections covering full marketplace design |
| Hybrid local+cloud sync architecture | Supabase poll-out pattern, security model |
| Agent interaction UX spec | 6 screens defining agent chat and management UX |
| Paperclip audit (`PAPERCLIP_AUDIT.md`) | Evaluation and deprecation rationale |
| Research pipeline + prompt templates | Perplexity + Gemini integration for deep research |
| Deep research: LLM memory systems | Survey of memory architectures for agent systems |
| Master plan with Planning Agent inbox | Strategic roadmap and task routing |
| Pitch deck outline + one-pager PDF | Investor/partner-facing materials |

---

## 5. Infrastructure

| Component | Details |
|-----------|---------|
| **Vercel** | Dashboard auto-deploys from GitHub (`main` branch) |
| **Supabase Cloud** | Sync layer, project `qsdtnnutusvkgnvnubxd` |
| **Ollama** | 13 models on M4 Pro 48GB (local inference) |
| **GitHub** | `SpaceTrev/space-agent-os`, 29+ PRs merged |
| **Hardware** | M4 Pro, 48GB RAM |

---

## 6. Dev Discipline Rules

These rules were established and enforced throughout the build sessions:

1. **Every change → PR → CodeRabbit review → merge.** No direct pushes to main.
2. **Never leave floating tasks.** If it's started, it gets finished or explicitly deferred with a note.
3. **Periodic audit for orphaned work.** Sweep for uncommitted changes, unmerged branches, TODO comments without tickets.
4. **Continuously update docs.** Architecture decisions get written down the same session they're made.
5. **Never stop until rate limited.** Maximize output per session.
6. **Schedule continuation tasks near limits.** When approaching rate limits or session end, create explicit continuation notes with full context.

---

## 7. Open Items & Next Priorities

### SpaceRuntime Phase 1

- [ ] Implement core event loop
- [ ] Build tool registry with dynamic registration
- [ ] Model router with tier-aware dispatching
- [ ] Session management and context tracking

### Skill Extraction Pipeline

- [ ] Auto-extract reusable skills from completed tasks
- [ ] Package as marketplace items with metadata
- [ ] Versioning and dependency tracking

### Browser Automation

- [ ] Playwright module for web scraping and interaction
- [ ] Integration with agent task dispatch

### Workflow Integration

- [ ] n8n workflow integration for complex multi-step automations
- [ ] Trigger agents from n8n nodes and vice versa

### Content Pipelines

- [ ] YouTube ingestion pipeline (transcription → summarization → vault)
- [ ] Research pipeline automation (Perplexity + Gemini)

### UI/UX

- [ ] Agent chat interface (conversational agent interaction)
- [ ] Team view visualization (see all agents and their status)

### Integrations

- [ ] Google Stitch MCP integration for design workflows
- [ ] TimescaleDB integration for persistent time-series metrics

### Infrastructure

- [ ] Named Cloudflare tunnel (or alternative) for remote access to local FastAPI
- [ ] Monitoring and alerting for sync layer health

---

## Appendix: Session Timeline

| Date | Key Deliverables |
|------|-----------------|
| Apr 7 | Brain vault setup, initial 6 domain vaults, SCHEMA.md |
| Apr 8 | CentralBrain fallback chain, FastAPI endpoints, Gemma 4 benchmarks |
| Apr 9 | Supabase sync layer, push/poll scripts, RLS policies |
| Apr 10 | Dashboard v1 on Vercel, Mission Control + Marketplace views |
| Apr 11 | SpaceRuntime architecture design, 12-week build plan |
| Apr 12 | Marketplace architecture (16 sections), UX spec (6 screens) |
| Apr 13 | Documentation consolidation, pitch materials, discipline rules codified |

---

*Last updated: April 13, 2026*
*Generated from build session notes — commit to repo as the canonical record of decisions made during this period.*
