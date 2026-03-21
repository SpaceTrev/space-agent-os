#!/usr/bin/env npx tsx
// ============================================================
// Agent OS — MCP Server (stdio transport)
//
// Exposes Agent OS operations as MCP tools so Claude (or any
// MCP client) can manage workspaces, agents, tasks, sprints,
// sessions, and usage programmatically.
//
// Run:  npx tsx mcp/server.ts
// Or add to claude_desktop_config.json / .mcp.json
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Config — reads from env vars (same .env.local as the Next.js app)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const BASE_URL = process.env.AGENT_OS_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Helpers — thin wrapper around Supabase REST API (no heavy deps)
// ---------------------------------------------------------------------------

async function supabaseRest(
  table: string,
  options: {
    method?: string
    query?: Record<string, string>
    body?: unknown
    select?: string
    single?: boolean
  } = {}
) {
  const { method = 'GET', query = {}, body, select, single } = options
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL)

  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v)
  }
  if (select) url.searchParams.set('select', select)

  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: single ? 'return=representation,count=exact' : 'return=representation',
  }

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json'
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'agent-os',
  version: '0.1.0',
})

// ========================== WORKSPACE TOOLS ==========================

server.tool(
  'list_workspaces',
  'List all workspaces in the organization',
  {},
  async () => {
    const data = await supabaseRest('workspaces', {
      select: 'id,name,slug,description,status,created_at',
      query: { order: 'created_at.desc' },
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_workspace',
  'Get details of a specific workspace by slug or ID',
  { identifier: z.string().describe('Workspace slug or UUID') },
  async ({ identifier }) => {
    const isUuid = /^[0-9a-f]{8}-/.test(identifier)
    const query: Record<string, string> = isUuid
      ? { id: `eq.${identifier}` }
      : { slug: `eq.${identifier}` }
    const data = await supabaseRest('workspaces', {
      select: 'id,name,slug,description,status,created_at,organization_id',
      query,
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_workspace',
  'Create a new workspace',
  {
    organization_id: z.string().uuid().describe('Organization ID'),
    name: z.string().describe('Workspace name'),
    slug: z.string().describe('URL-safe slug'),
    description: z.string().optional().describe('Workspace description'),
  },
  async ({ organization_id, name, slug, description }) => {
    const data = await supabaseRest('workspaces', {
      method: 'POST',
      body: { organization_id, name, slug, description, status: 'active' },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ========================== AGENT TOOLS ==========================

server.tool(
  'list_agents',
  'List all agents in a workspace',
  { workspace_id: z.string().uuid().describe('Workspace ID') },
  async ({ workspace_id }) => {
    const data = await supabaseRest('agents', {
      select: 'id,name,description,type,status,model,system_prompt,total_tasks_completed,total_tokens_used,total_cost,created_at',
      query: { workspace_id: `eq.${workspace_id}`, order: 'created_at.desc' },
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_agent',
  'Get details of a specific agent',
  { agent_id: z.string().uuid().describe('Agent ID') },
  async ({ agent_id }) => {
    const data = await supabaseRest('agents', {
      select: '*',
      query: { id: `eq.${agent_id}` },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_agent',
  'Create a new agent in a workspace',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    name: z.string().describe('Agent name'),
    type: z.enum(['worker', 'orchestrator', 'specialist', 'reviewer']).describe('Agent type'),
    model: z.string().describe('Model identifier (e.g. anthropic:claude-sonnet-4-20250514)'),
    description: z.string().optional().describe('Agent role description'),
    system_prompt: z.string().optional().describe('System prompt for the agent'),
  },
  async ({ workspace_id, name, type, model, description, system_prompt }) => {
    const data = await supabaseRest('agents', {
      method: 'POST',
      body: {
        workspace_id,
        name,
        type,
        model,
        description: description || null,
        system_prompt: system_prompt || null,
        status: 'idle',
      },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'update_agent',
  'Update an existing agent',
  {
    agent_id: z.string().uuid().describe('Agent ID'),
    name: z.string().optional(),
    description: z.string().optional(),
    model: z.string().optional(),
    system_prompt: z.string().optional(),
    status: z.enum(['idle', 'running', 'paused', 'error', 'archived']).optional(),
  },
  async ({ agent_id, ...updates }) => {
    const body = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    const data = await supabaseRest('agents', {
      method: 'PATCH',
      query: { id: `eq.${agent_id}` },
      body,
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ========================== TASK TOOLS ==========================

server.tool(
  'list_tasks',
  'List tasks in a workspace, optionally filtered by status or agent',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    status: z.string().optional().describe('Filter by status (pending, queued, running, completed, failed, canceled)'),
    agent_id: z.string().uuid().optional().describe('Filter by agent ID'),
    sprint_id: z.string().uuid().optional().describe('Filter by sprint ID'),
    limit: z.number().optional().default(20).describe('Max results'),
  },
  async ({ workspace_id, status, agent_id, sprint_id, limit }) => {
    const query: Record<string, string> = {
      workspace_id: `eq.${workspace_id}`,
      order: 'created_at.desc',
      limit: String(limit),
    }
    if (status) query.status = `eq.${status}`
    if (agent_id) query.agent_id = `eq.${agent_id}`
    if (sprint_id) query.sprint_id = `eq.${sprint_id}`

    const data = await supabaseRest('tasks', {
      select: 'id,title,description,status,priority,agent_id,sprint_id,cost_usd,tokens_input,tokens_output,created_at,started_at,completed_at',
      query,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_task',
  'Get full details of a task including logs',
  { task_id: z.string().uuid().describe('Task ID') },
  async ({ task_id }) => {
    const task = await supabaseRest('tasks', {
      select: '*',
      query: { id: `eq.${task_id}` },
      single: true,
    })
    // Also fetch recent logs
    const logs = await supabaseRest('task_logs', {
      select: 'id,level,message,metadata,created_at',
      query: { task_id: `eq.${task_id}`, order: 'created_at.desc', limit: '50' },
    })
    return { content: [{ type: 'text', text: JSON.stringify({ task, logs }, null, 2) }] }
  }
)

server.tool(
  'create_task',
  'Create and optionally queue a new task',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Full task description/prompt'),
    agent_id: z.string().uuid().optional().describe('Assign to specific agent'),
    sprint_id: z.string().uuid().optional().describe('Assign to sprint'),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal'),
    queue: z.boolean().optional().default(true).describe('Immediately queue for execution'),
  },
  async ({ workspace_id, title, description, agent_id, sprint_id, priority, queue }) => {
    const task = await supabaseRest('tasks', {
      method: 'POST',
      body: {
        workspace_id,
        title,
        description: description || title,
        agent_id: agent_id || null,
        sprint_id: sprint_id || null,
        priority,
        status: queue ? 'queued' : 'pending',
      },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] }
  }
)

server.tool(
  'update_task',
  'Update a task (status, priority, assignment)',
  {
    task_id: z.string().uuid().describe('Task ID'),
    status: z.enum(['pending', 'queued', 'running', 'completed', 'failed', 'canceled']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    agent_id: z.string().uuid().optional().describe('Reassign to agent'),
    result: z.string().optional().describe('Task result/output'),
    error: z.string().optional().describe('Error message if failed'),
  },
  async ({ task_id, ...updates }) => {
    const body: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    )
    if (updates.status === 'running') body.started_at = new Date().toISOString()
    if (updates.status === 'completed' || updates.status === 'failed') body.completed_at = new Date().toISOString()

    const data = await supabaseRest('tasks', {
      method: 'PATCH',
      query: { id: `eq.${task_id}` },
      body,
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'add_task_log',
  'Add a log entry to a task',
  {
    task_id: z.string().uuid().describe('Task ID'),
    level: z.enum(['info', 'warn', 'error', 'debug', 'step']).default('info'),
    message: z.string().describe('Log message'),
    metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
  },
  async ({ task_id, level, message, metadata }) => {
    const data = await supabaseRest('task_logs', {
      method: 'POST',
      body: { task_id, level, message, metadata: metadata || {} },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ========================== SPRINT TOOLS ==========================

server.tool(
  'list_sprints',
  'List sprints in a workspace',
  { workspace_id: z.string().uuid().describe('Workspace ID') },
  async ({ workspace_id }) => {
    const data = await supabaseRest('sprints', {
      select: 'id,name,description,status,goal,starts_at,ends_at,completed_at,created_at',
      query: { workspace_id: `eq.${workspace_id}`, order: 'created_at.desc' },
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_sprint',
  'Create a new sprint',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    name: z.string().describe('Sprint name'),
    goal: z.string().optional().describe('Sprint goal'),
    starts_at: z.string().optional().describe('Start date (ISO 8601)'),
    ends_at: z.string().optional().describe('End date (ISO 8601)'),
  },
  async ({ workspace_id, name, goal, starts_at, ends_at }) => {
    const data = await supabaseRest('sprints', {
      method: 'POST',
      body: {
        workspace_id,
        name,
        goal: goal || null,
        starts_at: starts_at || null,
        ends_at: ends_at || null,
        status: 'planning',
      },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'update_sprint',
  'Update a sprint (name, goal, status, dates)',
  {
    sprint_id: z.string().uuid().describe('Sprint ID'),
    name: z.string().optional(),
    goal: z.string().optional(),
    status: z.enum(['planning', 'active', 'completed', 'canceled']).optional(),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
  },
  async ({ sprint_id, ...updates }) => {
    const body: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    )
    if (updates.status === 'completed') body.completed_at = new Date().toISOString()

    const data = await supabaseRest('sprints', {
      method: 'PATCH',
      query: { id: `eq.${sprint_id}` },
      body,
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ========================== SESSION TOOLS ==========================

server.tool(
  'list_sessions',
  'List sessions in a workspace',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    limit: z.number().optional().default(20),
  },
  async ({ workspace_id, limit }) => {
    const data = await supabaseRest('sessions', {
      select: 'id,type,status,agent_id,task_id,total_tokens,total_cost,created_at,ended_at',
      query: { workspace_id: `eq.${workspace_id}`, order: 'created_at.desc', limit: String(limit) },
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'create_session',
  'Create a new interactive session',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    agent_id: z.string().uuid().optional().describe('Agent ID'),
    task_id: z.string().uuid().optional().describe('Associated task ID'),
    session_type: z.string().optional().describe('Session type label'),
  },
  async ({ workspace_id, agent_id, task_id, session_type }) => {
    const data = await supabaseRest('sessions', {
      method: 'POST',
      body: {
        workspace_id,
        agent_id: agent_id || null,
        task_id: task_id || null,
        session_type: session_type || 'interactive',
        type: 'interactive',
        status: 'running',
        transcript: [],
      },
      single: true,
    })
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ========================== USAGE TOOLS ==========================

server.tool(
  'get_usage',
  'Get usage summary for a workspace (tasks, tokens, cost)',
  { workspace_id: z.string().uuid().describe('Workspace ID') },
  async ({ workspace_id }) => {
    // Count tasks by status
    const tasks = await supabaseRest('tasks', {
      select: 'id,status,cost_usd,tokens_input,tokens_output',
      query: { workspace_id: `eq.${workspace_id}` },
    })

    const summary = {
      total_tasks: tasks.length,
      by_status: {} as Record<string, number>,
      total_cost_usd: 0,
      total_tokens_input: 0,
      total_tokens_output: 0,
      total_tokens: 0,
    }

    for (const t of tasks) {
      summary.by_status[t.status] = (summary.by_status[t.status] || 0) + 1
      summary.total_cost_usd += Number(t.cost_usd) || 0
      summary.total_tokens_input += Number(t.tokens_input) || 0
      summary.total_tokens_output += Number(t.tokens_output) || 0
    }
    summary.total_tokens = summary.total_tokens_input + summary.total_tokens_output

    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
  }
)

// ========================== DISPATCH TOOL ==========================

server.tool(
  'dispatch_task',
  'Create a task and immediately dispatch it for execution via the Agent OS API. This triggers the actual task runner.',
  {
    workspace_id: z.string().uuid().describe('Workspace ID'),
    agent_id: z.string().uuid().describe('Agent ID to run the task'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Full prompt/description'),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal'),
    sprint_id: z.string().uuid().optional().describe('Sprint to assign to'),
  },
  async ({ workspace_id, agent_id, title, description, priority, sprint_id }) => {
    // Call the Next.js /api/run endpoint which creates + queues + runs the task
    const res = await fetch(`${BASE_URL}/api/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({
        workspace_id,
        agent_id,
        title,
        description: description || title,
        priority,
        sprint_id: sprint_id || undefined,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { content: [{ type: 'text', text: `Error dispatching task: ${res.status} ${err}` }], isError: true }
    }

    const data = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP Server Error:', err)
  process.exit(1)
})
