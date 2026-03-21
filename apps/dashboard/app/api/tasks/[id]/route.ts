// ============================================================
// GET /api/tasks/[id]  — get task details
// PUT /api/tasks/[id]  — update task (approve, status change, etc.)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const supabase = await getSupabaseServerClient()

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, agent:agents(id, name, type, model), sprint:sprints(id, name, status)')
      .eq('id', id)
      .single()

    if (error || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((task as { workspace_id: string }).workspace_id, user.id, 'viewer')

    return NextResponse.json({ task })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json()

    const supabase = await getSupabaseServerClient()

    const { data: existing, error: fetchError } = await supabase
      .from('tasks')
      .select('workspace_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((existing as { workspace_id: string }).workspace_id, user.id, 'developer')

    const allowedFields = [
      'title',
      'description',
      'priority',
      'agent_id',
      'sprint_id',
      'input',
      'tags',
      'metadata',
      'estimated_duration_seconds',
      'depends_on',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    updates.updated_at = new Date().toISOString()

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
