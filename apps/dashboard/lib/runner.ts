// ============================================================
// Agent OS — Task Runner
// Executes agent tasks: loads task + agent, calls model,
// streams logs, records usage, updates stats.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/db'
import { estimateCost } from '@/lib/models/registry'
import { getAgentSkills, buildSkillPrompt } from '@/lib/skills'
import { sendWhatsApp } from '@/lib/whatsapp/client'
import { executeWithChain, type ChainResult } from '@/lib/execution'
import type { Agent, Task, ModelMessage, ModelProviderType } from '@/lib/types'

// ============================================================
// Helper: write a task log entry
// ============================================================

async function writeTaskLog(
  taskId: string,
  agentId: string | null,
  level: 'debug' | 'info' | 'warn' | 'error',
  type: 'system' | 'llm_call' | 'tool_call' | 'tool_result' | 'agent_thought' | 'agent_action' | 'retry' | 'error',
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  await supabase.from('task_logs').insert({
    task_id: taskId,
    agent_id: agentId,
    level,
    type,
    message,
    data: data ?? null,
    created_at: new Date().toISOString(),
  })
}

// (API key resolution is now handled by lib/execution/provider-chain.ts)

// ============================================================
// runTask — main entry point called by the queue
// ============================================================

export async function runTask(taskId: string): Promise<void> {
  const supabase = getSupabaseAdminClient()

  // --------------------------------------------------------
  // 1. Load the task
  // --------------------------------------------------------

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*, agent:agents(*), workspace:workspaces(*)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  const agent = task.agent as Agent | null
  const workspaceId = task.workspace_id as string

  // --------------------------------------------------------
  // 2. Mark task as running
  // --------------------------------------------------------

  await supabase
    .from('tasks')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  // Update agent status
  if (agent?.id) {
    await supabase
      .from('agents')
      .update({ status: 'running', current_task_id: taskId })
      .eq('id', agent.id)
  }

  await writeTaskLog(taskId, agent?.id ?? null, 'info', 'system', `Task started: ${task.title}`)

  const startTime = Date.now()

  try {
    // --------------------------------------------------------
    // 3. Build system prompt
    // --------------------------------------------------------

    let systemPrompt = agent?.system_prompt ?? ''

    // Append skill files
    if (agent) {
      try {
        const skills = await getAgentSkills(agent as Agent)
        const skillPrompt = buildSkillPrompt(skills)
        if (skillPrompt) {
          systemPrompt += skillPrompt
          await writeTaskLog(
            taskId,
            agent.id,
            'debug',
            'system',
            `Loaded ${skills.length} skill file(s): ${skills.map((s) => s.filename).join(', ')}`
          )
        }
      } catch (skillErr) {
        await writeTaskLog(taskId, agent?.id ?? null, 'warn', 'system', `Could not load skill files: ${skillErr}`)
      }
    }

    // --------------------------------------------------------
    // 4. Build messages
    // --------------------------------------------------------

    const messages: ModelMessage[] = []

    // Include task description as the user message
    const userContent = [
      `# Task: ${task.title}`,
      '',
      task.description ?? '',
      '',
      task.input && Object.keys(task.input).length > 0
        ? `## Additional Context\n\`\`\`json\n${JSON.stringify(task.input, null, 2)}\n\`\`\``
        : '',
    ]
      .filter((line) => line !== null)
      .join('\n')
      .trim()

    messages.push({ role: 'user', content: userContent })

    // --------------------------------------------------------
    // 5. Execute via ProviderChain (model selection + key +
    //    fallback + retry all handled by the chain)
    // --------------------------------------------------------

    const agentConfig = (agent as Agent | null)?.config ?? {
      temperature: 0.7,
      max_tokens: 4096,
      stream_output: false,
      max_iterations: 1,
      retry_on_error: true,
      max_retries: 3,
      retry_delay_seconds: 2,
      enable_memory: false,
      memory_top_k: 5,
      timeout_seconds: 300,
    }

    const chainResult: ChainResult = await executeWithChain({
      workspaceId,
      agentModel: agent?.model ?? null,
      messages,
      system: systemPrompt || undefined,
      temperature: agentConfig.temperature,
      max_tokens: agentConfig.max_tokens,
      maxRetries: agentConfig.max_retries,
      retryDelayMs: (agentConfig.retry_delay_seconds ?? 2) * 1000,
      onLog: (level, message, data) =>
        writeTaskLog(taskId, agent?.id ?? null, level, 'llm_call', message, data),
    })

    const { result, provider, model: modelId } = chainResult

    // Log execution chain attempts
    if (chainResult.attempts.length > 1) {
      await writeTaskLog(
        taskId,
        agent?.id ?? null,
        'info',
        'system',
        `Execution chain used ${chainResult.attempts.length} attempt(s) across providers`,
        { attempts: chainResult.attempts, api_key_source: chainResult.api_key_source }
      )
    }

    // --------------------------------------------------------
    // 6. Calculate cost
    // --------------------------------------------------------

    const costUsd = estimateCost(provider, modelId, result.tokens_input, result.tokens_output)

    // --------------------------------------------------------
    // 9. Determine final task status
    // --------------------------------------------------------

    const requiresApproval = (task.metadata as Record<string, unknown>)?.requires_approval === true
    const finalStatus = requiresApproval ? 'needs_review' : 'completed'

    // --------------------------------------------------------
    // 10. Update task with result
    // --------------------------------------------------------

    const actualDurationSeconds = Math.round((Date.now() - startTime) / 1000)

    await supabase
      .from('tasks')
      .update({
        status: finalStatus,
        output: {
          content: result.content,
          tool_calls: result.tool_calls ?? [],
          finish_reason: result.finish_reason,
        },
        model_used: `${provider}:${modelId}`,
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        cost_usd: costUsd,
        completed_at: new Date().toISOString(),
        actual_duration_seconds: actualDurationSeconds,
      })
      .eq('id', taskId)

    await writeTaskLog(
      taskId,
      agent?.id ?? null,
      'info',
      'system',
      `Task ${finalStatus}. Duration: ${actualDurationSeconds}s. Cost: $${costUsd.toFixed(6)}`
    )

    // --------------------------------------------------------
    // 11. Record usage event
    // --------------------------------------------------------

    const workspaceData = task.workspace as { organization_id?: string } | null

    await supabase.from('usage_events').insert({
      organization_id: workspaceData?.organization_id ?? null,
      workspace_id: workspaceId,
      agent_id: agent?.id ?? null,
      task_id: taskId,
      session_id: null,
      event_type: 'llm_tokens',
      quantity: result.tokens_input + result.tokens_output,
      cost_usd: costUsd,
      model: `${provider}:${modelId}`,
      provider,
      metadata: {
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        duration_ms: chainResult.attempts.reduce((sum, a) => sum + a.duration_ms, 0),
      },
      recorded_at: new Date().toISOString(),
    })

    // --------------------------------------------------------
    // 12. Update agent stats
    // --------------------------------------------------------

    if (agent?.id) {
      const { data: currentAgent } = await supabase
        .from('agents')
        .select('total_tasks_completed, total_tokens_used, total_cost')
        .eq('id', agent.id)
        .single()

      if (currentAgent) {
        await supabase
          .from('agents')
          .update({
            status: 'idle',
            current_task_id: null,
            total_tasks_completed: ((currentAgent as { total_tasks_completed?: number }).total_tasks_completed ?? 0) + 1,
            total_tokens_used:
              ((currentAgent as { total_tokens_used?: number }).total_tokens_used ?? 0) +
              result.tokens_input +
              result.tokens_output,
            total_cost:
              ((currentAgent as { total_cost?: number }).total_cost ?? 0) + costUsd,
          })
          .eq('id', agent.id)
      } else {
        await supabase
          .from('agents')
          .update({ status: 'idle', current_task_id: null })
          .eq('id', agent.id)
      }
    }

    // --------------------------------------------------------
    // 13. Update workspace api_cost_this_month
    // --------------------------------------------------------

    const { data: workspaceRow } = await supabase
      .from('workspaces')
      .select('api_cost_this_month')
      .eq('id', workspaceId)
      .single()

    if (workspaceRow) {
      await supabase
        .from('workspaces')
        .update({
          api_cost_this_month:
            ((workspaceRow as { api_cost_this_month?: number }).api_cost_this_month ?? 0) + costUsd,
        })
        .eq('id', workspaceId)
    }

    // --------------------------------------------------------
    // 14. WhatsApp callback (if task originated from WhatsApp)
    // --------------------------------------------------------

    const whatsappFrom = (task.metadata as Record<string, unknown>)?.whatsapp_from as string | undefined
    if (whatsappFrom) {
      const statusEmoji = finalStatus === 'completed' ? '✅' : '🔍'
      await sendWhatsApp(
        whatsappFrom,
        `${statusEmoji} Task ${finalStatus}: ${task.title}\nDuration: ${actualDurationSeconds}s | Cost: $${costUsd.toFixed(4)}`
      ).catch((e) => console.error('[Runner] WhatsApp callback failed:', e))
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const actualDurationSeconds = Math.round((Date.now() - startTime) / 1000)

    await writeTaskLog(taskId, agent?.id ?? null, 'error', 'error', `Task failed: ${errorMessage}`, {
      error: errorMessage,
    })

    // Mark task as failed
    await supabase
      .from('tasks')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        actual_duration_seconds: actualDurationSeconds,
      })
      .eq('id', taskId)

    // Reset agent status
    if (agent?.id) {
      await supabase
        .from('agents')
        .update({ status: 'idle', current_task_id: null })
        .eq('id', agent.id)
    }

    // WhatsApp error callback
    const whatsappFrom = (task.metadata as Record<string, unknown>)?.whatsapp_from as string | undefined
    if (whatsappFrom) {
      await sendWhatsApp(
        whatsappFrom,
        `❌ Task failed: ${task.title}\nError: ${errorMessage}`
      ).catch((e) => console.error('[Runner] WhatsApp error callback failed:', e))
    }

    throw err
  }
}
