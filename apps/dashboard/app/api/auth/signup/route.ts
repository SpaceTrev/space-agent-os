// ============================================================
// POST /api/auth/signup — Create account + org + workspace
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { name, orgName, email, password } = await req.json()

    if (!name || !orgName || !email || !password) {
      return NextResponse.json(
        { error: { message: 'All fields are required' } },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: { message: 'Password must be at least 8 characters' } },
        { status: 400 }
      )
    }

    // Use admin client to create the user (server-side, bypasses RLS)
    const admin = getSupabaseAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })

    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message } },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: { message: 'Failed to create user' } },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    // Get free plan ID
    const { data: freePlan } = await admin
      .from('plans')
      .select('id')
      .eq('tier', 'free')
      .single()

    if (!freePlan) {
      return NextResponse.json(
        { error: { message: 'No free plan found. Run the database migration first.' } },
        { status: 500 }
      )
    }

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Create organization
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: orgName,
        slug,
        plan_id: (freePlan as { id: string }).id,
        owner_id: userId,
        billing_email: email,
      })
      .select()
      .single()

    if (orgError) {
      return NextResponse.json(
        { error: { message: `Failed to create organization: ${orgError.message}` } },
        { status: 500 }
      )
    }

    const orgId = (org as { id: string }).id

    // Create default workspace
    const { data: workspace, error: wsError } = await admin
      .from('workspaces')
      .insert({
        organization_id: orgId,
        name: 'Default',
        slug: 'default',
        description: `Default workspace for ${orgName}`,
        status: 'active',
        created_by: userId,
      })
      .select()
      .single()

    if (wsError) {
      return NextResponse.json(
        { error: { message: `Failed to create workspace: ${wsError.message}` } },
        { status: 500 }
      )
    }

    const workspaceId = (workspace as { id: string }).id

    // Add user as workspace owner
    await admin.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })

    // Sign in the new user using SSR server client (auto-manages cookies)
    const { getSupabaseServerClient } = await import('@/lib/db')
    const supabase = await getSupabaseServerClient()

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      // User + org + workspace created but sign-in failed — not fatal
      console.warn('[Signup] Auto sign-in failed:', signInError.message)
    }

    return NextResponse.json(
      {
        user: authData.user,
        session: signInData?.session ?? null,
        organization: org,
        workspace,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[Signup] Error:', err)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
