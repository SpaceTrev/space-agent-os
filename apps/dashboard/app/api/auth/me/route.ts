// ============================================================
// GET /api/auth/me — Get current authenticated user + workspaces
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Get workspaces the user belongs to
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces(*, organization:organizations(id, name, slug, plan_id))')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    const workspaces = (memberships ?? []).map((m: { role: string; workspace: unknown }) => ({
      ...(m.workspace as Record<string, unknown>),
      member_role: m.role,
    }))

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
      },
      workspaces,
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
