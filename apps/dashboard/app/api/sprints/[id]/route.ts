// ============================================================
// GET    /api/sprints/[id]  — get sprint
// PUT    /api/sprints/[id]  — update sprint
// DELETE /api/sprints/[id]  — delete sprint
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

    const { data: sprint, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((sprint as { workspace_id: string }).workspace_id, user.id, 'viewer')

    // Load tasks for this sprint
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, priority, agent_id, created_at')
      .eq('sprint_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ sprint: { ...sprint, tasks: tasks ?? [] } })
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
      .from('sprints')
      .select('workspace_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((existing as { workspace_id: string }).workspace_id, user.id, 'developer')

    const allowedFields = ['name', 'description', 'status', 'goal', 'starts_at', 'ends_at']

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // Auto-set completed_at when transitioning to completed
    if (updates.status === 'completed' && (existing as { status: string }).status !== 'completed') {
      updates.completed_at = new Date().toISOString()
    }

    updates.updated_at = new Date().toISOString()

    const { data: sprint, error } = await supabase
      .from('sprints')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sprint })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const supabase = await getSupabaseServerClient()

    const { data: existing, error: fetchError } = await supabase
      .from('sprints')
      .select('workspace_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((existing as { workspace_id: string }).workspace_id, user.id, 'admin')

    if ((existing as { status: string }).status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete an active sprint. Complete or cancel it first.' },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('sprints').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
