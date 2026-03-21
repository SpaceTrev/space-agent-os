// ============================================================
// GET    /api/compute/[id]  — get server status
// DELETE /api/compute/[id]  — teardown server
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'
import { getServerStatus, stopServer } from '@/lib/compute'
import type { ComputeProvider } from '@/lib/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const supabase = await getSupabaseServerClient()

    const { data: server, error } = await supabase
      .from('compute_servers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((server as { workspace_id: string }).workspace_id, user.id, 'viewer')

    // Fetch live status from provider
    let liveStatus: { status: string; public_url: string | null } | null = null
    try {
      liveStatus = await getServerStatus(
        (server as { provider: ComputeProvider }).provider,
        (server as { provider_server_id: string }).provider_server_id,
        (server as { provider_metadata: Record<string, unknown> }).provider_metadata
      )

      // Update DB if status changed
      if (liveStatus.status !== (server as { status: string }).status) {
        await supabase
          .from('compute_servers')
          .update({
            status: liveStatus.status,
            public_url: liveStatus.public_url ?? (server as { public_url: string | null }).public_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      }
    } catch {
      // Live status fetch failed — return cached status
    }

    return NextResponse.json({
      server: {
        ...server,
        live_status: liveStatus?.status ?? (server as { status: string }).status,
      },
    })
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

    const { data: server, error: fetchError } = await supabase
      .from('compute_servers')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    await requireWorkspaceAccessById((server as { workspace_id: string }).workspace_id, user.id, 'admin')

    // Stop the server via the provider API
    try {
      await stopServer(
        (server as { provider: ComputeProvider }).provider,
        (server as { provider_metadata: Record<string, unknown> }).provider_metadata
      )
    } catch (stopErr) {
      console.error('[Compute] Failed to stop server via provider:', stopErr)
      // Continue — update DB even if provider call fails
    }

    // Update DB status to stopped
    await supabase
      .from('compute_servers')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
