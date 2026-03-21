// ============================================================
// GET /api/billing/subscription?workspace_id=xxx
// Returns current subscription info (Stripe + plan data)
// Falls back to seed data when Stripe is not configured
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'

const SEED_SUBSCRIPTION = {
  plan: 'pro',
  plan_name: 'Pro',
  status: 'active',
  current_period_start: '2026-03-01T00:00:00Z',
  current_period_end: '2026-03-31T23:59:59Z',
  monthly_task_limit: 5000,
  monthly_token_limit: 20000000,
  stripe_customer_id: null,
  billing_cycle: 'monthly',
  features: ['unlimited_agents', 'priority_support', 'custom_models', 'api_access'],
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const workspaceId = req.nextUrl.searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    await requireWorkspaceAccessById(workspaceId, user.id, 'viewer')

    const supabase = await getSupabaseServerClient()

    // Try to get org + plan info from Supabase
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, organization_id, organizations(id, plan_id, stripe_customer_id, subscription_status, billing_cycle, plans(*))')
      .eq('id', workspaceId)
      .single()

    if (workspace) {
      const org = (workspace as Record<string, unknown>).organizations as Record<string, unknown> | null
      const plan = org?.plans as Record<string, unknown> | null

      if (org && plan) {
        return NextResponse.json({
          subscription: {
            plan: (plan.tier as string) ?? 'pro',
            plan_name: (plan.name as string) ?? 'Pro',
            status: (org.subscription_status as string) ?? 'active',
            current_period_start: SEED_SUBSCRIPTION.current_period_start,
            current_period_end: SEED_SUBSCRIPTION.current_period_end,
            monthly_task_limit: (plan.max_concurrent_tasks as number) ?? 5000,
            monthly_token_limit: ((plan.token_budget_millions as number) ?? 20) * 1_000_000,
            stripe_customer_id: (org.stripe_customer_id as string | null) ?? null,
            billing_cycle: (org.billing_cycle as string) ?? 'monthly',
            features: (plan.features as string[]) ?? SEED_SUBSCRIPTION.features,
          },
        })
      }
    }

    // Stripe not configured or plan not found — return seed fallback
    return NextResponse.json({ subscription: SEED_SUBSCRIPTION })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
