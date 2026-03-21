// ============================================================
// WhatsApp command router — parse incoming text & dispatch
// ============================================================

import { getSupabaseAdminClient } from '@/lib/db'
import { addTask } from '@/lib/queue'

// ============================================================
// Public API
// ============================================================

export async function routeCommand(text: string, from: string): Promise<string> {
  const trimmed = text.trim()

  // /run <workspace> <agent> <task description>
  if (trimmed.startsWith('/run ')) return handleRun(trimmed, from)

  // /status <workspace>
  if (trimmed.startsWith('/status ')) return handleStatus(trimmed)

  // /help (or any unrecognised input)
  if (trimmed.startsWith('/help') || !trimmed.startsWith('/')) return helpText()

  return `Unknown command. ${helpText()}`
}

// ============================================================
// Command handlers
// ============================================================

async function handleRun(text: string, from: string): Promise<string> {
  // Expected: /run <workspace> <agent> <task description...>
  const parts = text.replace('/run ', '').trim().split(/\s+/)

  if (parts.length < 3) {
    return 'Usage: /run <workspace> <agent> <task description>'
  }

  const workspaceSlug = parts[0]
  const agentName = parts[1]
  const taskDescription = parts.slice(2).join(' ')

  const supabase = getSupabaseAdminClient()

  // Look up workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspaceSlug)
    .single()

  if (!workspace) {
    return `Workspace "${workspaceSlug}" not found.`
  }

  const workspaceId = (workspace as { id: string }).id

  // Look up agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, status')
    .eq('workspace_id', workspaceId)
    .ilike('name', agentName)
    .single()

  if (!agent) {
    return `Agent "${agentName}" not found in workspace "${workspaceSlug}".`
  }

  if ((agent as { status: string }).status === 'archived') {
    return `Agent "${(agent as { name: string }).name}" is archived and cannot run tasks.`
  }

  // Create & queue task
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      agent_id: (agent as { id: string }).id,
      title: `WhatsApp: ${taskDescription.slice(0, 100)}`,
      description: taskDescription,
      status: 'queued',
      priority: 'normal',
      input: { source: 'whatsapp', from },
      output: null,
      error_message: null,
      retry_count: 0,
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
      depends_on: [],
      tags: ['whatsapp'],
      metadata: { whatsapp_from: from },
      queued_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !task) {
    return 'Failed to create task. Please try again.'
  }

  addTask((task as { id: string }).id)

  return [
    `✅ Task queued for *${(agent as { name: string }).name}*`,
    `> ${taskDescription}`,
    `Task ID: ${(task as { id: string }).id}`,
  ].join('\n')
}

async function handleStatus(text: string): Promise<string> {
  const workspaceSlug = text.replace('/status ', '').trim().split(/\s+/)[0]

  if (!workspaceSlug) {
    return 'Usage: /status <workspace>'
  }

  const supabase = getSupabaseAdminClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspaceSlug)
    .single()

  if (!workspace) {
    return `Workspace "${workspaceSlug}" not found.`
  }

  const workspaceId = (workspace as { id: string }).id

  const [{ count: running }, { count: queued }, { count: agents }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'running'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'queued'),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).neq('status', 'archived'),
  ])

  return [
    `📊 *${(workspace as { name: string }).name}*`,
    `Agents: ${agents ?? 0}`,
    `Running: ${running ?? 0}`,
    `Queued: ${queued ?? 0}`,
  ].join('\n')
}

function helpText(): string {
  return [
    '🤖 *Agent OS — WhatsApp Remote Control*',
    '',
    '`/run <workspace> <agent> <task>`',
    '  Queue a task for an agent',
    '',
    '`/status <workspace>`',
    '  View workspace status',
    '',
    '`/help`',
    '  Show this message',
    '',
    'You can also send a voice note and it will be transcribed into a command.',
  ].join('\n')
}
