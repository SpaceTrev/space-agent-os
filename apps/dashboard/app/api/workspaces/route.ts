// ============================================================
// GET  /api/workspaces  — list workspaces for current user
// POST /api/workspaces  — create workspace
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, toErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const supabase = await getSupabaseServerClient()

    // Get all workspaces the user is a member of
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const workspaces = (memberships ?? []).map((m: { role: string; workspace: unknown }) => ({
      ...(m.workspace as Record<string, unknown>),
      member_role: m.role,
    }))

    return NextResponse.json({ workspaces })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { name, slug, description, organization_id, settings } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 })
    }

    // Create workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        organization_id: organization_id ?? null,
        name,
        slug,
        description: description ?? null,
        status: 'active',
        settings: settings ?? {
          default_agent_model: 'gemini:gemini-2.0-flash-exp',
          max_task_retries: 3,
          task_timeout_seconds: 300,
          enable_agent_memory: false,
          memory_retention_days: 30,
          auto_pause_on_budget_exhaustion: true,
          notification_channels: [],
        },
        model_config: {
          providers: {},
          default_provider: 'gemini',
          default_model: 'gemini-2.0-flash-exp',
          fallback_model: null,
        },
        created_by: user.id,
      })
      .select()
      .single()

    if (wsError) {
      return NextResponse.json({ error: wsError.message }, { status: 500 })
    }

    const workspaceId = (workspace as { id: string }).id

    // Add creator as owner
    await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: 'owner',
      invited_by: null,
      joined_at: new Date().toISOString(),
    })

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
