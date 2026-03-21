// ============================================================
// POST /api/tasks/[id]/run — manually trigger task execution
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'
import { addTask } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: taskId } = await params

    const supabase = await getSupabaseServerClient()

    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((task as { workspace_id: string }).workspace_id, user.id, 'developer')

    const taskStatus = (task as { status: string }).status

    // Cannot run tasks that are already running or completed (unless forcing)
    const body = await req.json().catch(() => ({}))
    const { force = false } = body as { force?: boolean }

    if (taskStatus === 'running') {
      return NextResponse.json({ error: 'Task is already running' }, { status: 409 })
    }

    if (taskStatus === 'completed' && !force) {
      return NextResponse.json(
        {
          error: 'Task is already completed. Pass force=true to re-run.',
        },
        { status: 409 }
      )
    }

    // Reset task state for re-run
    await supabase
      .from('tasks')
      .update({
        status: 'queued',
        queued_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        output: null,
        error_message: null,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        retry_count: force
          ? (task as { retry_count: number }).retry_count
          : (task as { retry_count: number }).retry_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    addTask(taskId)

    return NextResponse.json({
      success: true,
      task_id: taskId,
      status: 'queued',
      message: 'Task queued for execution',
    })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
