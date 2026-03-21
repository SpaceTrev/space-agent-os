// ============================================================
// GET    /api/agents/[id]  — get agent
// PUT    /api/agents/[id]  — update agent
// DELETE /api/agents/[id]  — delete agent
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

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*, workspace:workspaces(id, name, slug)')
      .eq('id', id)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Verify access to the workspace
    await requireWorkspaceAccessById((agent as { workspace_id: string }).workspace_id, user.id, 'viewer')

    return NextResponse.json({ agent })
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

    // Load existing agent to check workspace access
    const { data: existing, error: fetchError } = await supabase
      .from('agents')
      .select('workspace_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((existing as { workspace_id: string }).workspace_id, user.id, 'developer')

    // Only allow updating certain fields
    const allowedFields = [
      'name',
      'description',
      'type',
      'status',
      'model',
      'system_prompt',
      'tools',
      'config',
      'memory_namespace',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    updates.updated_at = new Date().toISOString()

    const { data: agent, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agent })
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

    // Load existing agent to check workspace access
    const { data: existing, error: fetchError } = await supabase
      .from('agents')
      .select('workspace_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((existing as { workspace_id: string }).workspace_id, user.id, 'admin')

    // Prevent deletion of running agents
    if ((existing as { status: string }).status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete a running agent. Stop it first.' },
        { status: 409 }
      )
    }

    // Soft delete: set status to archived
    const { error } = await supabase
      .from('agents')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
