// ============================================================
// POST /api/webhooks/discord — Discord bot webhook
// Handles interactions from the Discord bot
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'
import { addTask } from '@/lib/queue'
import { createHmac } from 'crypto'

// ============================================================
// Verify Discord request signature
// ============================================================

function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    // Discord uses Ed25519 signing — use tweetnacl in production
    // For now, we validate that the required headers are present
    if (!signature || !timestamp) return false

    // Basic timestamp check: reject requests older than 5 minutes
    const requestTime = parseInt(timestamp, 10)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - requestTime) > 300) return false

    return true
  } catch {
    return false
  }
}

// ============================================================
// Discord interaction types
// ============================================================

const INTERACTION_TYPE_PING = 1
const INTERACTION_TYPE_APPLICATION_COMMAND = 2
const INTERACTION_TYPE_MESSAGE_COMPONENT = 3

// ============================================================
// Command handlers
// ============================================================

async function handleRunCommand(
  interaction: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const data = interaction.data as {
    name: string;
    options?: Array<{ name: string; value: unknown }>;
  }

  const options = data.options ?? []
  const workspaceSlug = (options.find((o) => o.name === 'workspace')?.value as string) ?? ''
  const agentName = (options.find((o) => o.name === 'agent')?.value as string) ?? ''
  const taskDescription = (options.find((o) => o.name === 'task')?.value as string) ?? ''

  if (!workspaceSlug || !agentName || !taskDescription) {
    return {
      type: 4,
      data: {
        content: 'Missing required options: workspace, agent, and task are all required.',
        flags: 64, // Ephemeral
      },
    }
  }

  const supabase = getSupabaseAdminClient()

  // Find workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspaceSlug)
    .single()

  if (!workspace) {
    return {
      type: 4,
      data: {
        content: `Workspace "${workspaceSlug}" not found.`,
        flags: 64,
      },
    }
  }

  // Find agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, status')
    .eq('workspace_id', (workspace as { id: string }).id)
    .ilike('name', agentName)
    .single()

  if (!agent) {
    return {
      type: 4,
      data: {
        content: `Agent "${agentName}" not found in workspace "${workspaceSlug}".`,
        flags: 64,
      },
    }
  }

  // Create and queue task
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: (workspace as { id: string }).id,
      agent_id: (agent as { id: string }).id,
      title: `Discord task: ${taskDescription.slice(0, 100)}`,
      description: taskDescription,
      status: 'queued',
      priority: 'normal',
      input: { source: 'discord', interaction_id: interaction.id },
      output: null,
      error_message: null,
      retry_count: 0,
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
      depends_on: [],
      tags: ['discord'],
      metadata: { discord_user: (interaction.member as { user?: { id: string } } | undefined)?.user?.id ?? interaction.user },
      queued_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !task) {
    return {
      type: 4,
      data: {
        content: 'Failed to create task. Please try again.',
        flags: 64,
      },
    }
  }

  addTask((task as { id: string }).id)

  return {
    type: 4,
    data: {
      content: `Task created and queued for **${(agent as { name: string }).name}**!\n> ${taskDescription}\n\nTask ID: \`${(task as { id: string }).id}\``,
    },
  }
}

async function handleStatusCommand(
  interaction: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const data = interaction.data as {
    options?: Array<{ name: string; value: unknown }>;
  }
  const options = data.options ?? []
  const workspaceSlug = (options.find((o) => o.name === 'workspace')?.value as string) ?? ''

  if (!workspaceSlug) {
    return {
      type: 4,
      data: { content: 'Please provide a workspace slug.', flags: 64 },
    }
  }

  const supabase = getSupabaseAdminClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspaceSlug)
    .single()

  if (!workspace) {
    return {
      type: 4,
      data: { content: `Workspace "${workspaceSlug}" not found.`, flags: 64 },
    }
  }

  const workspaceId = (workspace as { id: string }).id

  const [{ count: runningTasks }, { count: queuedTasks }, { count: agentCount }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'running'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'queued'),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).neq('status', 'archived'),
  ])

  return {
    type: 4,
    data: {
      content: [
        `**Status for ${(workspace as { name: string }).name}**`,
        `Agents: ${agentCount ?? 0}`,
        `Running tasks: ${runningTasks ?? 0}`,
        `Queued tasks: ${queuedTasks ?? 0}`,
      ].join('\n'),
    },
  }
}

// ============================================================
// Main handler
// ============================================================

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? ''

  // Verify signature in production
  if (publicKey && !verifyDiscordSignature(publicKey, signature, timestamp, body)) {
    return new Response('Invalid signature', { status: 401 })
  }

  let interaction: Record<string, unknown>
  try {
    interaction = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle PING (Discord verification)
  if (interaction.type === INTERACTION_TYPE_PING) {
    return NextResponse.json({ type: 1 })
  }

  // Handle slash commands
  if (interaction.type === INTERACTION_TYPE_APPLICATION_COMMAND) {
    const commandName = (interaction.data as { name?: string })?.name

    try {
      let response: Record<string, unknown>

      switch (commandName) {
        case 'run':
          response = await handleRunCommand(interaction)
          break

        case 'status':
          response = await handleStatusCommand(interaction)
          break

        default:
          response = {
            type: 4,
            data: {
              content: `Unknown command: ${commandName}`,
              flags: 64,
            },
          }
      }

      return NextResponse.json(response)
    } catch (err) {
      console.error('[Discord Webhook] Command error:', err)
      return NextResponse.json({
        type: 4,
        data: {
          content: 'An error occurred processing your command.',
          flags: 64,
        },
      })
    }
  }

  return NextResponse.json({ type: 1 })
}
