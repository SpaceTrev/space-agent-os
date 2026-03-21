// ============================================================
// POST /api/webhooks/linear — Linear webhook handler
// Creates tasks from Linear issues automatically
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'
import { addTask } from '@/lib/queue'
import { createHmac } from 'crypto'

// ============================================================
// Verify Linear webhook signature
// ============================================================

function verifyLinearSignature(
  webhookSecret: string,
  signature: string,
  body: string
): boolean {
  if (!webhookSecret || !signature) return false

  try {
    const hmac = createHmac('sha256', webhookSecret)
    hmac.update(body)
    const expectedSignature = hmac.digest('hex')

    // Constant-time comparison
    if (signature.length !== expectedSignature.length) return false

    let result = 0
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}

// ============================================================
// Map Linear issue priority to our task priority
// ============================================================

function mapLinearPriority(priority: number): 'low' | 'normal' | 'high' | 'critical' {
  switch (priority) {
    case 1: return 'critical'
    case 2: return 'high'
    case 3: return 'normal'
    case 4: return 'low'
    default: return 'normal'
  }
}

// ============================================================
// Handle issue created/updated events
// ============================================================

async function handleIssueEvent(
  action: string,
  data: Record<string, unknown>
): Promise<{ created: boolean; task_id?: string }> {
  const supabase = getSupabaseAdminClient()

  const linearIssueId = data.id as string
  const title = data.title as string
  const description = data.description as string | undefined
  const priority = data.priority as number | undefined
  const teamId = (data.team as { id?: string } | undefined)?.id
  const labels = (data.labels as Array<{ name: string }> | undefined)?.map((l) => l.name) ?? []
  const assigneeId = (data.assignee as { id?: string } | undefined)?.id

  // Only process issues with the "agent-os" label or matching workspace config
  const isAgentOsTask = labels.some((l) =>
    l.toLowerCase().includes('agent-os') || l.toLowerCase().includes('ai-task')
  )

  if (!isAgentOsTask && action !== 'create') {
    return { created: false }
  }

  // Find workspace configured for this Linear team
  const { data: workspaceConfig } = await supabase
    .from('workspaces')
    .select('id, settings')
    .filter('settings->linear_team_id', 'eq', teamId)
    .single()

  if (!workspaceConfig) {
    console.log(`[Linear Webhook] No workspace configured for team ${teamId}`)
    return { created: false }
  }

  const workspaceId = (workspaceConfig as { id: string }).id

  // Check if task already exists for this issue
  const { data: existingTask } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .filter('metadata->linear_issue_id', 'eq', linearIssueId)
    .single()

  if (existingTask && action === 'create') {
    return { created: false }
  }

  // Find an appropriate agent (Engineer by default)
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'idle')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agent) {
    console.log(`[Linear Webhook] No idle agent found for workspace ${workspaceId}`)
    return { created: false }
  }

  // Create task
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      agent_id: (agent as { id: string }).id,
      title: `[Linear] ${title}`,
      description: description ?? title,
      status: 'queued',
      priority: mapLinearPriority(priority ?? 3),
      input: {
        source: 'linear',
        linear_issue_id: linearIssueId,
        linear_assignee_id: assigneeId,
      },
      output: null,
      error_message: null,
      retry_count: 0,
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
      depends_on: [],
      tags: ['linear', ...labels],
      metadata: {
        linear_issue_id: linearIssueId,
        linear_team_id: teamId,
        source: 'linear_webhook',
      },
      queued_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !task) {
    console.error('[Linear Webhook] Failed to create task:', error)
    return { created: false }
  }

  addTask((task as { id: string }).id)

  return { created: true, task_id: (task as { id: string }).id }
}

// ============================================================
// Main handler
// ============================================================

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('linear-signature') ?? ''
  const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET ?? ''

  // Verify signature
  if (webhookSecret && !verifyLinearSignature(webhookSecret, signature, body)) {
    console.error('[Linear Webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = payload.action as string
  const type = payload.type as string
  const data = payload.data as Record<string, unknown>

  console.log(`[Linear Webhook] ${type}.${action}`)

  try {
    switch (type) {
      case 'Issue': {
        if (action === 'create' || action === 'update') {
          const result = await handleIssueEvent(action, data)
          if (result.created) {
            console.log(`[Linear Webhook] Created task ${result.task_id} for issue ${data.id}`)
          }
        }
        break
      }

      case 'Comment': {
        // Could create review tasks from comments
        const issueId = (data.issue as { id?: string } | undefined)?.id
        console.log(`[Linear Webhook] Comment on issue ${issueId}`)
        break
      }

      case 'Project':
      case 'ProjectUpdate': {
        console.log(`[Linear Webhook] Project event: ${action}`)
        break
      }

      default:
        console.log(`[Linear Webhook] Unhandled type: ${type}`)
    }
  } catch (err) {
    console.error('[Linear Webhook] Processing error:', err)
    return NextResponse.json(
      { error: `Processing failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
