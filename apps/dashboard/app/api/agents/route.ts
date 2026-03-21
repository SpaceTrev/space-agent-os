// ============================================================
// GET  /api/agents?workspace_id=xxx  — list agents
// POST /api/agents                   — create agent
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const workspaceId = req.nextUrl.searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    // Verify access
    await requireWorkspaceAccessById(workspaceId, user.id, 'viewer')

    const supabase = await getSupabaseServerClient()

    let query = supabase
      .from('agents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    // Optional filters
    const status = req.nextUrl.searchParams.get('status')
    if (status) query = query.eq('status', status)

    const type = req.nextUrl.searchParams.get('type')
    if (type) query = query.eq('type', type)

    const { data: agents, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Seed fallback: return realistic demo data when DB is empty
    if (!agents || agents.length === 0) {
      const now = Date.now()
      const seedAgents = [
        {
          id: 'agent-001', workspace_id: workspaceId, name: 'Research Agent', type: 'specialist',
          status: 'idle', model: 'gemini:gemini-2.0-flash', description: 'Finds and synthesizes information from multiple sources.',
          system_prompt: 'You are a research specialist. Find and synthesize information accurately.',
          tools: [], config: { max_iterations: 5, temperature: 0.7, max_tokens: 4096, retry_on_error: true, max_retries: 3, retry_delay_seconds: 2, enable_memory: false, memory_top_k: 5, stream_output: false, timeout_seconds: 300 },
          current_task_id: null, memory_namespace: null, metadata: { skills: ['web_search', 'summarization'] },
          created_by: 'seed', created_at: new Date(now - 7 * 24 * 3600000).toISOString(), updated_at: new Date(now - 7 * 24 * 3600000).toISOString(),
        },
        {
          id: 'agent-002', workspace_id: workspaceId, name: 'Code Agent', type: 'worker',
          status: 'idle', model: 'anthropic:claude-sonnet-4-6', description: 'Writes clean, well-tested code across multiple languages.',
          system_prompt: 'You are a coding assistant. Write clean, well-tested code.',
          tools: [], config: { max_iterations: 10, temperature: 0.3, max_tokens: 8192, retry_on_error: true, max_retries: 3, retry_delay_seconds: 2, enable_memory: false, memory_top_k: 5, stream_output: true, timeout_seconds: 600 },
          current_task_id: null, memory_namespace: null, metadata: { skills: ['code_generation', 'debugging'] },
          created_by: 'seed', created_at: new Date(now - 5 * 24 * 3600000).toISOString(), updated_at: new Date(now - 5 * 24 * 3600000).toISOString(),
        },
        {
          id: 'agent-003', workspace_id: workspaceId, name: 'Orchestrator', type: 'orchestrator',
          status: 'idle', model: 'groq:llama-3.1-70b-versatile', description: 'Coordinates agent teams to complete complex, multi-step tasks.',
          system_prompt: 'You coordinate agent teams to complete complex tasks.',
          tools: [], config: { max_iterations: 20, temperature: 0.5, max_tokens: 4096, retry_on_error: true, max_retries: 5, retry_delay_seconds: 3, enable_memory: true, memory_top_k: 10, stream_output: false, timeout_seconds: 900 },
          current_task_id: null, memory_namespace: null, metadata: { skills: ['task_planning', 'delegation'] },
          created_by: 'seed', created_at: new Date(now - 3 * 24 * 3600000).toISOString(), updated_at: new Date(now - 3 * 24 * 3600000).toISOString(),
        },
      ]
      return NextResponse.json({ agents: seedAgents })
    }

    return NextResponse.json({ agents })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { workspace_id, name, description, type, model, system_prompt, tools, config } = body

    if (!workspace_id || !name) {
      return NextResponse.json({ error: 'workspace_id and name are required' }, { status: 400 })
    }

    // Verify access
    await requireWorkspaceAccessById(workspace_id, user.id, 'developer')

    const supabase = await getSupabaseServerClient()

    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        workspace_id,
        name,
        description: description ?? null,
        type: type ?? 'worker',
        status: 'idle',
        model: model ?? null,
        system_prompt: system_prompt ?? '',
        tools: tools ?? [],
        config: config ?? {
          max_iterations: 5,
          temperature: 0.7,
          max_tokens: 4096,
          retry_on_error: true,
          max_retries: 3,
          retry_delay_seconds: 2,
          enable_memory: false,
          memory_top_k: 5,
          stream_output: false,
          timeout_seconds: 300,
        },
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agent }, { status: 201 })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
