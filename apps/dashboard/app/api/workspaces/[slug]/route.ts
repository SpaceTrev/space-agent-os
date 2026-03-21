// ============================================================
// GET /api/workspaces/[slug]  — get workspace details
// PUT /api/workspaces/[slug]  — update workspace
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, getCurrentWorkspace, requireWorkspaceAccess, toErrorResponse } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { slug } = await params

    const { workspace, role } = await getCurrentWorkspace(slug, user.id)

    const supabase = await getSupabaseServerClient()

    // Get agent count
    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', (workspace as { id: string }).id)
      .neq('status', 'archived')

    // Get active task count
    const { count: activeTaskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', (workspace as { id: string }).id)
      .in('status', ['pending', 'queued', 'running'])

    // Get member count
    const { count: memberCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', (workspace as { id: string }).id)

    return NextResponse.json({
      workspace: {
        ...workspace,
        member_role: role,
        stats: {
          agent_count: agentCount ?? 0,
          active_task_count: activeTaskCount ?? 0,
          member_count: memberCount ?? 0,
        },
      },
    })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { slug } = await params
    const body = await req.json()

    // Require admin role to update workspace settings
    const { workspace } = await requireWorkspaceAccess(slug, user.id, 'admin')

    const allowedFields = ['name', 'description', 'status', 'settings', 'model_config']

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // Prevent updating slug directly
    if ('slug' in body) {
      return NextResponse.json({ error: 'Workspace slug cannot be changed' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const supabase = await getSupabaseServerClient()

    const { data: updatedWorkspace, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', (workspace as { id: string }).id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workspace: updatedWorkspace })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
