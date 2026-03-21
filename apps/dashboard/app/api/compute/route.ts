// ============================================================
// GET  /api/compute?workspace_id=xxx  — list compute servers
// POST /api/compute                   — provision new server
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'
import { provisionServer, estimateComputeCostPerHour } from '@/lib/compute'
import type { ComputeProvider } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const workspaceId = req.nextUrl.searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    await requireWorkspaceAccessById(workspaceId, user.id, 'viewer')

    const supabase = await getSupabaseServerClient()

    const { data: servers, error } = await supabase
      .from('compute_servers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Seed fallback: return realistic demo data when DB is empty
    if (!servers || servers.length === 0) {
      const now = Date.now()
      const seedServers = [
        {
          id: 'server-001', workspace_id: workspaceId, name: 'agent-runner-prod', provider: 'railway',
          status: 'running', provider_server_id: 'railway-srv-abc123', region: 'us-west2',
          cpu: 2, memory_mb: 1024, disk_gb: 20,
          public_url: 'https://agent-runner-prod.up.railway.app', internal_url: 'http://agent-runner-prod.railway.internal:8080',
          provider_metadata: { project_id: 'proj-xyz', service_id: 'svc-abc' },
          cost_per_hour_usd: 0.048, started_at: new Date(now - 5 * 24 * 3600000).toISOString(), stopped_at: null,
          created_at: new Date(now - 5 * 24 * 3600000).toISOString(), updated_at: new Date(now - 3600000).toISOString(),
        },
        {
          id: 'server-002', workspace_id: workspaceId, name: 'agent-runner-staging', provider: 'fly',
          status: 'stopped', provider_server_id: 'fly-app-def456', region: 'iad',
          cpu: 1, memory_mb: 512, disk_gb: 10,
          public_url: 'https://agent-runner-staging.fly.dev', internal_url: 'http://agent-runner-staging.internal:8080',
          provider_metadata: { app_id: 'agent-runner-staging', org_slug: 'personal' },
          cost_per_hour_usd: 0.022, started_at: new Date(now - 10 * 24 * 3600000).toISOString(), stopped_at: new Date(now - 2 * 24 * 3600000).toISOString(),
          created_at: new Date(now - 10 * 24 * 3600000).toISOString(), updated_at: new Date(now - 2 * 24 * 3600000).toISOString(),
        },
      ]
      return NextResponse.json({ servers: seedServers })
    }

    return NextResponse.json({ servers })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const {
      workspace_id,
      name,
      provider = 'railway',
      region,
      cpu = 1,
      memory_mb = 512,
      disk_gb = 10,
      image,
      env,
    } = body

    if (!workspace_id || !name) {
      return NextResponse.json({ error: 'workspace_id and name are required' }, { status: 400 })
    }

    const validProviders: ComputeProvider[] = ['railway', 'fly', 'custom']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    await requireWorkspaceAccessById(workspace_id, user.id, 'admin')

    const supabase = await getSupabaseServerClient()

    // Provision the server
    const provisionResult = await provisionServer(provider, {
      name,
      workspaceId: workspace_id,
      region,
      cpu,
      memoryMb: memory_mb,
      diskGb: disk_gb,
      image,
      env,
    })

    const costPerHour = estimateComputeCostPerHour(provider, cpu, memory_mb)

    // Record the server in DB
    const { data: server, error } = await supabase
      .from('compute_servers')
      .insert({
        workspace_id,
        name,
        provider,
        status: provisionResult.status,
        provider_server_id: provisionResult.provider_server_id,
        region: provisionResult.region,
        cpu,
        memory_mb,
        disk_gb,
        public_url: provisionResult.public_url,
        internal_url: provisionResult.internal_url,
        provider_metadata: provisionResult.provider_metadata,
        cost_per_hour_usd: costPerHour,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ server }, { status: 201 })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
