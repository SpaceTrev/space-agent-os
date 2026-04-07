# Space-Agent-OS — Linear Project Plan
# Generated: 2026-03-26
# Owner: Trev + Pablo
# Agent: Space-Claw

---

## MILESTONE 1: Platform Foundation (Current Sprint)
> Get agent-os fully operational as a working product we use ourselves

### ✅ Done
- [x] Turborepo monorepo structure
- [x] EventBus + PipelineManager (event-driven, no polling)
- [x] HeartbeatEngine wired to EventBus
- [x] Full agent roster (13 agents across 4 departments)
- [x] CentralBrain routing (CHAT/CODE/PLAN/RESEARCH/ARCHITECT/SWARM)
- [x] Claude Max proxy (claude-max-api-proxy at localhost:3456)
- [x] Dashboard (Next.js) + Supabase local DB live
- [x] Mission Control page (/mission-control)
- [x] Discord bot (discord.py 2.x subclass, slash commands working)
- [x] agent_mcp server (health_check, list_tasks, run_tests, engine_status)
- [x] 12/12 smoke tests passing
- [x] 5/5 health nodes green
- [x] LaunchAgents for claude-max-proxy + heartbeat + discord-bot

### 🔴 URGENT
- [ ] Discord bot crash loop via LaunchAgent — needs process supervision fix
- [ ] Discord /ask command end-to-end test with real Claude response
- [ ] Set DISCORD_MESSAGE_CONTENT_INTENT=true in dev portal (for @mention routing)

### 🟠 HIGH
- [ ] Remote access — OpenClaw mobile pairing (Tailscale or LAN)
- [ ] Clamshell mode / always-on setup (external display or Railway deploy)
- [ ] Supabase: create first user + workspace via dashboard signup flow
- [ ] Discord bot: add /plan, /deploy, /workflow commands
- [ ] agent_mcp: add start_discord_bot + start_proxy to engine_status

---

## MILESTONE 2: Mission Control — Client-Facing Product
> Dashboard becomes the product clients log into

### Core pages needed
- [ ] **Onboarding chatbot** — intake flow, auto-configure agent team
  - Conversational UI (first thing after signup)
  - Questions: industry, team size, main workflows, tools used
  - Output: suggested agent team + first 3 workflows
- [ ] **Integrations page** — connect external tools
  - Gmail (OAuth)
  - Slack (webhook/OAuth)
  - Discord (bot token)
  - WhatsApp (Twilio)
  - TradingView webhooks
  - Railway API
  - Zapier webhook receiver
- [ ] **Workflow builder** — define and lock in automations
  - Visual flow or natural language definition
  - Trigger: schedule / webhook / event / manual
  - Steps: agent actions, tool calls, conditions
  - Save as reusable template
  - This is the compound moat
- [ ] **Analytics dashboard**
  - Tasks run (count, success rate, error rate)
  - Time saved estimates per workflow
  - Agent utilization by role
  - Weekly/monthly trends
- [ ] **Cost dashboard**
  - Per agent, per workflow, per workspace
  - Model usage breakdown (Claude vs Ollama vs Gemini)
  - Projected monthly cost
  - Cost per automation run
- [ ] **Fleet view (super-admin)**
  - All deployed space-claw instances
  - Per-client health, last heartbeat, active workflows
  - Push updates to client deployments
  - This is the Trev+Pablo view

### Infrastructure
- [ ] Supabase: workflow_templates table
- [ ] Supabase: analytics/usage_events schema
- [ ] Supabase: integrations table (per workspace)
- [ ] API routes: /api/workflows, /api/analytics, /api/integrations
- [ ] Real-time updates via Supabase Realtime (SSE already exists for tasks)

---

## MILESTONE 3: Space-Claw Deployment Package
> Make it trivial to deploy space-claw on a client's machine

- [ ] Single install command: `curl -fsSL spaceclaw.ai/install | bash`
- [ ] Installer sets up: OpenClaw + agent-os core + LaunchAgents
- [ ] Points back to Mission Control (configurable org endpoint)
- [ ] Client gets their own Mission Control workspace
- [ ] Trev/Pablo can see all client deployments from fleet view
- [ ] Auto-update mechanism (pull latest on heartbeat)

---

## MILESTONE 4: Design Agent Suite
> Agents that can design, not just code

- [ ] **Figma MCP integration** — read/write Figma via MCP server
  - List/read frames, components, styles
  - Create frames, update styles
  - Export assets
- [ ] **Lead Designer Agent** (upgrade stub to real)
  - Design system generation from brand brief
  - Component specs → Figma frames
  - Design review and feedback
- [ ] **Stitch/generative design integration**
  - High-fidelity mockup generation
  - Brand-consistent component generation
- [ ] **Design → Code handoff**
  - Designer agent outputs → Frontend Engineer agent consumes
  - Figma → React component pipeline

---

## MILESTONE 5: Space-Terminal Integration
> Use agent-os to build the trading platform, prove the product

- [ ] **Trade intelligence engine** (rebuild from space-trading)
  - Market scanner (Railway)
  - Signal generation
  - Discord reports (same Discord infrastructure as space-claw)
- [ ] **Trade assistant agent**
  - Personal assistant in #claw-chat or dedicated channel
  - Real-time level marking commentary
  - Scalping setup alerts
  - Morning briefing (overnight moves, key levels, economic calendar)
- [ ] **TradingView webhook receiver** — alerts → agent actions
- [ ] **Railway MCP** — agents can deploy/check space-terminal services
- [ ] **Testing MCP** — agents confirm their Railway deployments work
- [ ] **space-terminal as workspace in Mission Control**
  - The trading platform is just another workspace
  - Proves multi-workspace, multi-project capability

---

## MILESTONE 6: GTM + Content Infrastructure
> The machine that sells the machine

- [ ] **Social content pipeline**
  - Pablo drops voice note → agents produce 5 platform-specific posts
  - Trev automation wins → formatted technical content
  - spacetradinghq: financial news aggregation → auto-format → queue
- [ ] **Discord community setup**
  - Space-Claw bot in community Discord (separate from dev server)
  - AI assistant in #general, #trading, #automation channels
  - Community members can /ask the bot
- [ ] **Onboarding course content**
  - Day trading automation course outline (agent-generated)
  - Platform walkthrough scripts
  - "How I automated X" episode templates
- [ ] **Platform marketing site**
  - No personal branding, product-focused
  - spaceclaw.ai or space-agent-os.com
  - Waitlist + demo booking

---

## MILESTONE 7: Space Scribe (Project Brain)
> Memory layer for all agent teams

- [ ] **Space Scribe core**
  - YouTube → transcript → structured knowledge
  - PDF/docs → structured knowledge
  - Web pages → structured knowledge
- [ ] **Per-project MCP server**
  - Agents query project brain before each task
  - Knowledge grows with each run
  - Namespace per workspace/client
- [ ] **Industry brain seeds**
  - Mexican retail brain (pre-loaded knowledge)
  - Mexican SMB operations brain
  - Trading/finance brain
  - Each client starts with industry brain + onboarding customization
- [ ] **Knowledge graph UI**
  - Visualize what the brain knows
  - Add/remove/edit knowledge nodes
  - See which agents queried what

---

## IMMEDIATE NEXT 3 TASKS (this week)

1. **Fix Discord bot LaunchAgent stability** — use a proper supervisor (supervisord or a wrapper that doesn't hit macOS sandbox limits)
2. **Discord /status smoke test** — confirm end-to-end response in #claw-chat  
3. **Linear setup** — create this plan in actual Linear with proper issues/cycles

---

## Tech Stack Reference

| Layer | Tech | Status |
|-------|------|--------|
| Agent core | Python 3.13, asyncio, httpx | ✅ |
| LLM routing | claude-max-api-proxy → Claude Max | ✅ |
| Local models | Ollama (llama3.1:8b, qwen3-coder:30b) | ✅ |
| Event bus | Custom asyncio EventBus | ✅ |
| Discord | discord.py 2.7 | ✅ (bot live) |
| Dashboard | Next.js 15, React 19, Tailwind | ✅ |
| Database | Supabase (local + hosted) | ✅ |
| MCP | FastMCP (agent_mcp server) | ✅ |
| CI/Deploy | Railway (existing infra) | 🔲 |
| Design | Figma MCP (planned) | 🔲 |
| Content | Social agents (planned) | 🔲 |
| Knowledge | Space Scribe (planned) | 🔲 |
