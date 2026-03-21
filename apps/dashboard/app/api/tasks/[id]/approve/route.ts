// ============================================================
// POST /api/tasks/[id]/approve — approve a task requiring review
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

    // Only tasks that need review can be approved
    if (taskStatus !== 'needs_review' && taskStatus !== 'pending') {
      return NextResponse.json(
        {
          error: `Task cannot be approved in its current status: ${taskStatus}`,
        },
        { status: 409 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { action = 'approve', feedback } = body as { action?: string; feedback?: string }

    if (action === 'reject') {
      // Mark as failed with feedback
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          error_message: feedback ?? 'Rejected by reviewer',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    if (action === 'rerun') {
      // Queue for re-execution
      await supabase
        .from('tasks')
        .update({
          status: 'queued',
          queued_at: new Date().toISOString(),
          output: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)

      addTask(taskId)

      return NextResponse.json({ success: true, status: 'queued' })
    }

    // Default: approve — mark as completed
    await supabase
      .from('tasks')
      .update({
        status: 'completed',
        metadata: {
          ...(task as { metadata?: Record<string, unknown> }).metadata,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_feedback: feedback ?? null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    return NextResponse.json({ success: true, status: 'completed' })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
