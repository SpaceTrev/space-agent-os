# Agent OS

Multi-tenant AI agent orchestration platform. Run autonomous agent teams for your own projects, manage via web UI or MCP tools.

## What it is
- Multi-tenant workspaces (one per project/client)
- Agent teams with types (worker, orchestrator, specialist, reviewer)
- Sprint management for organizing agent work
- Task dispatch with real-time SSE log streaming
- Model-agnostic: Anthropic-first but any provider works
- Compute provisioning for persistent agent execution (Railway/Fly.io)
- MCP server for programmatic control from Claude or any MCP client

## Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Auth + DB**: Supabase (Postgres + Auth + RLS)
- **Background Jobs**: In-process queue (upgrade to Trigger.dev for production)
- **MCP**: `@modelcontextprotocol/sdk` stdio server
- **Compute**: Railway API + Fly.io API

## Model priority (free-first)
1. Gemini 2.0 Flash — free, fast, capable
2. Groq Llama 3.1 70B — free, very fast
3. Mistral Small — free, good quality
4. Perplexity Sonar — free, has web search (use for research agents)
5. Claude Sonnet — paid, highest quality

## Key architectural decisions
- Multi-tenancy via workspace_id on every table
- Row Level Security (RLS) in Supabase for data isolation
- API keys stored encrypted per workspace (AES-256)
- Usage events written on every task completion
- Free tier detection happens in model registry, not in components
- Auth via Supabase Auth with middleware route protection
- AuthProvider context wraps all client pages (no mock data)
- All frontend pages fetch from /api/* routes which query Supabase

## Adding a new model provider
1. Add provider to lib/models/registry.ts PROVIDERS object
2. Create lib/models/[provider].ts with callModel implementation
3. Add env var to .env.local.example
No other changes needed.

## Project structure
```
app/
  (app)/           — Authenticated app pages (dashboard, workspace views)
  (auth)/          — Login and signup pages
  api/             — 25 API routes (agents, tasks, sprints, sessions, compute, billing, auth, run, webhooks)
components/        — Reusable UI components (shared/, fleet/, tasks/, sprints/, billing/, models/)
lib/               — Core business logic
  auth.ts          — Auth helpers
  auth-context.tsx — Client-side AuthProvider + useAuth hook
  db.ts            — Supabase client factory (browser, server, admin)
  queue.ts         — In-memory task queue
  runner.ts        — Task execution runner
  sessions.ts      — Session runner
  models/          — 7 model providers + registry
mcp/
  server.ts        — MCP stdio server (20 tools)
supabase/
  migrations/      — 001_initial.sql + 002_fix_sessions_add_auth.sql
  config.toml      — Supabase local config
skills/            — Default skill file templates
middleware.ts      — Route protection (redirects unauthenticated users)
```

## Running locally
1. Copy `.env.local.example` to `.env.local` and fill in Supabase + Anthropic keys
2. `npm install`
3. Start Supabase: `npx supabase start` (or use a hosted project)
4. Run migrations: `npx supabase db push`
5. `npm run dev`
6. Visit: http://localhost:3000

## MCP server
The MCP server at `mcp/server.ts` exposes 20 tools for managing Agent OS:
- **Workspaces**: list, get, create
- **Agents**: list, get, create, update
- **Tasks**: list, get, create, update, add_task_log, dispatch_task
- **Sprints**: list, create, update
- **Sessions**: list, create
- **Usage**: get_usage

### Run standalone
```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx mcp/server.ts
```

### Add to Claude
The `.mcp.json` file in the project root auto-registers the server. Ensure env vars are set.

## Auth flow
1. Signup creates Supabase Auth user + organization + default workspace + workspace_member
2. Login sets httpOnly cookies (access + refresh tokens)
3. Middleware checks auth on all /dashboard and /[workspace] routes
4. /api/auth/me returns current user + workspaces for the AuthProvider
5. All /api/* routes use getSupabaseServerClient() which reads cookies

## Current state
- [x] DB schema with RLS (2 migrations)
- [x] Model registry (7 providers)
- [x] Task runner with SSE log streaming
- [x] Auth routes (login, signup, logout, me) + middleware
- [x] AuthProvider context (no mock data anywhere)
- [x] Dashboard — real workspace stats from Supabase
- [x] Workspace fleet view — real agents + servers + usage
- [x] Agents list — real data
- [x] Tasks page — real data + real dispatch via /api/run
- [x] Sprints page — real data + real creation
- [x] Compute page — real data + real provisioning
- [x] MCP server with 20 tools
- [x] .env.local.example with all env vars documented
- [ ] Stripe billing (deferred — focus on core tool first)
- [ ] Discord bot (deferred)
- [ ] Supabase local setup instructions need Xcode CLT update
