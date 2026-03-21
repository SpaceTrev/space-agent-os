// ============================================================
// POST /api/run — high-level "run a task" endpoint
// Creates a task and immediately dispatches it to the queue
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'
import { addTask } from '@/lib/queue'
import { getStatus } from '@/lib/queue'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const {
      workspace_id,
      agent_id,
      title,
      description,
      input,
      sprint_id,
      priority = 'normal',
      tags,
      metadata,
      requires_approval = false,
    } = body

    if (!workspace_id || !agent_id || !title) {
      return NextResponse.json(
        { error: 'workspace_id, agent_id, and title are required' },
        { status: 400 }
      )
    }

    await requireWorkspaceAccessById(workspace_id, user.id, 'developer')

    const supabase = await getSupabaseServerClient()

    // Verify agent exists and belongs to workspace
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, status')
      .eq('id', agent_id)
      .eq('workspace_id', workspace_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found in this workspace' }, { status: 404 })
    }

    if ((agent as { status: string }).status === 'archived') {
      return NextResponse.json({ error: 'Agent is archived and cannot run tasks' }, { status: 409 })
    }

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        workspace_id,
        agent_id,
        sprint_id: sprint_id ?? null,
        title,
        description: description ?? '',
        status: 'queued',
        priority,
        input: input ?? {},
        output: null,
        error_message: null,
        retry_count: 0,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        depends_on: [],
        tags: tags ?? [],
        metadata: {
          ...(metadata ?? {}),
          requires_approval,
        },
        queued_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    const taskId = (task as { id: string }).id

    // Add to execution queue
    addTask(taskId)

    // Return task + queue status
    const queueStatus = getStatus()

    return NextResponse.json(
      {
        task,
        queue: queueStatus,
        message: `Task queued for agent "${(agent as { name: string }).name}"`,
      },
      { status: 201 }
    )
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
