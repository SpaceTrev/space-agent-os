# Agent OS UI Revamp — Implementation Plan

## Problem Summary

The Agent OS dashboard has four issues identified during a live review:

1. **Sessions page is missing** — The sidebar links to `/{workspace}/sessions` but no page directory exists, causing a 404. The API route (`/api/sessions`) and types (`Session`, `SessionMessage`) already exist.
2. **Billing page uses hardcoded mock data** — All numbers (costs, usage, margins) are inline constants instead of fetched from the API or Supabase.
3. **Agent creation form has hardcoded models** — The "new agent" form has a static model list instead of fetching from `/api/models/available`.
4. **Plan tiers are too few** — `lib/types.ts` defines `'free' | 'starter' | 'pro' | 'enterprise'` (4 tiers). User wants 7 tiers.

## User Review Required

> [!IMPORTANT]
> **Plan Tier Names:** The current 4 tiers are `free | starter | pro | enterprise`. You mentioned wanting 7.  
> Please confirm the exact 7 tier names you'd like. Suggested:  
> `'free' | 'hobby' | 'starter' | 'pro' | 'team' | 'business' | 'enterprise'`  
> If different, let me know before I proceed.

> [!IMPORTANT]
> **Billing Data Source:** The billing page currently shows `baseSubscription`, `extraTasks`, `compute hours`, `margin by department`, etc. Should this all come from:
> - (A) Supabase tables (usage tracking tables + workspace plan), or  
> - (B) Stripe API (subscription, invoices, usage records), or  
> - (C) Both (Supabase for usage metrics, Stripe for subscription/invoice data)?  
>   
> For now, the plan assumes **(C)** — Supabase for usage stats and Stripe for subscription info — but this can be adjusted.

---

## Proposed Changes

### Phase 1 — Sessions Page (Missing Page → 404 Fix)

#### [NEW] [page.tsx](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/(app)/[workspace]/sessions/page.tsx)

Create sessions list page:
- Client component fetching `GET /api/sessions?workspace_id={id}`
- Table with columns: Type, Participants, Status, Sprint, Created At
- Status badges (standup/planning/refinement/retro/strategy)
- Link each row to a detail view
- Empty state with icon + "Start a session" CTA
- Loading spinner matching the Agents page pattern

#### [NEW] [page.tsx](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/(app)/[workspace]/sessions/[id]/page.tsx)

Create session detail page:
- Fetches session by ID from a new `GET /api/sessions/[id]` route
- Shows session metadata (type, participants, status, sprint, timestamps)
- Displays session messages in a chat-like timeline
- Back link to sessions list

#### [NEW] [route.ts](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/api/sessions/[id]/route.ts)

New API route to get a single session plus its messages:
- `GET /api/sessions/:id` — returns session + messages
- Auth guard with `requireAuth` + `requireWorkspaceAccessById`

---

### Phase 2 — Billing Page (Replace Mock Data)

#### [MODIFY] [page.tsx](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/(app)/[workspace]/billing/page.tsx)

- Convert from server component with hardcoded data → client component
- Fetch usage data from `GET /api/billing/usage?workspace_id={id}`
- Fetch subscription info from a new `GET /api/billing/subscription` endpoint
- Keep the same visual layout (UsageMeter, CostBreakdown, Margin table, History)
- Show loading skeleton while data fetches
- Handle error states gracefully

#### [NEW] [route.ts](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/api/billing/subscription/route.ts)

New API route:
- Returns current plan name, tier, limits, billing cycle, next billing date
- Pulls from Supabase `organizations` → `plans` join + Stripe subscription status
- Auth guarded

#### [MODIFY] [route.ts](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/api/billing/usage/route.ts)

Extend existing usage route to also return:
- Monthly history (last 3–6 months)
- Department/swarm margin breakdown (from a Supabase query on task completions grouped by agent type or department)

---

### Phase 3 — Agent Model Selector (Hardcoded → API)

#### [MODIFY] [page.tsx](file:///Users/trevspace/Space/active-projects/space-agent-teams/app/(app)/[workspace]/agents/new/page.tsx)

- Replace the hardcoded `models` array with a `useEffect` fetch to `GET /api/models/available?workspace_id={id}`
- Show a loading state in the select dropdown while models load
- Group models by provider in the dropdown (OpenAI, Anthropic, Google, etc.)
- Fallback gracefully if the API returns empty or errors

---

### Phase 4 — Expand Plan Tiers (4 → 7)

#### [MODIFY] [types.ts](file:///Users/trevspace/Space/active-projects/space-agent-teams/lib/types.ts)

- Change `PlanTier` from `'free' | 'starter' | 'pro' | 'enterprise'` to the 7-tier version (pending user confirmation of names)
- No other code references PlanTier in a way that would break — it's used as a type annotation only

#### [MODIFY] Supabase migration (if applicable)

- If there's a `plans` table with a `tier` column check constraint, update it to allow the new values
- This may require a new migration file or an `ALTER TYPE` statement

---

## Verification Plan

### Browser Testing (Primary)

Since there are **no existing project-level tests**, verification will be done via the browser subagent tool against the local dev server (`npm run dev`).

1. **Sessions Page Loads (Phase 1)**
   - Navigate to `http://localhost:3000/{workspace}/sessions`
   - Verify the page loads (no 404)
   - Verify the sessions list or empty state renders
   - Screenshot for evidence

2. **Billing Page Shows Dynamic Data (Phase 2)**
   - Navigate to `http://localhost:3000/{workspace}/billing`
   - Verify the page loads with a loading state then real data (or graceful empty state if no data)
   - Confirm hardcoded "March 2026" text is gone
   - Screenshot for evidence

3. **Agent New Form Fetches Models (Phase 3)**
   - Navigate to `http://localhost:3000/{workspace}/agents/new`
   - Open the model selector dropdown
   - Verify models are loaded from the API (not hardcoded)
   - Screenshot for evidence

4. **Build Passes (All Phases)**
   - Run `npm run build` to verify TypeScript compiles with no errors
   - Run `npm run lint` to verify no lint issues

### Manual Testing (User)

> [!NOTE]
> Since the billing page requires active Supabase data and potentially Stripe test keys, full end-to-end billing verification will need you to confirm the data looks correct against your actual workspace data. I'll make sure the page gracefully handles empty/null data.

### Suggested Order of Execution

1. Phase 4 (types change — smallest, unblocks nothing but good to do first)
2. Phase 1 (sessions page — new files only, no risk of breaking existing code)
3. Phase 3 (agent model selector — small modify)
4. Phase 2 (billing — most complex, modifies existing page + API)
