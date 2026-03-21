// ============================================================
// Agent OS — Session Runner
// Handles structured multi-agent meetings:
// standup, planning, refinement, retro, strategy
// ============================================================

import { getSupabaseAdminClient } from '@/lib/db'
import { callModel, parseModelString, selectBestFreeModel, estimateCost } from '@/lib/models/registry'
import { getAgentSkills, buildSkillPrompt } from '@/lib/skills'
import { safeDecryptApiKey } from '@/lib/encryption'
import type { Agent, ModelMessage, ModelProviderType } from '@/lib/types'

// ============================================================
// Session Types
// ============================================================

export type AgentSessionType = 'standup' | 'planning' | 'refinement' | 'retro' | 'strategy'

export interface SessionParticipant {
  agentId: string
  role?: string
}

export interface RunSessionParams {
  workspaceId: string
  sessionType: AgentSessionType
  participants: SessionParticipant[]
  context?: Record<string, unknown>
  sprintId?: string
  createdBy?: string
}

export interface SessionTranscriptEntry {
  agentId: string
  agentName: string
  role: string
  content: string
  tokensInput: number
  tokensOutput: number
  costUsd: number
  timestamp: string
}

export interface SessionResult {
  sessionId: string
  transcript: SessionTranscriptEntry[]
  summary: string
  outputs: Record<string, unknown>
  totalTokens: number
  totalCost: number
}

// ============================================================
// Prompt templates per session type
// ============================================================

const SESSION_PROMPTS: Record<AgentSessionType, (context: Record<string, unknown>) => string> = {
  standup: (ctx) => `
You are participating in a daily standup meeting for an AI agent team.

The standup follows the classic format. Each agent should answer:
1. What did I work on since the last standup?
2. What am I working on today?
3. Are there any blockers?

Current context:
${JSON.stringify(ctx, null, 2)}

Keep your update concise (3-5 sentences). Be specific about tasks and outcomes.
`.trim(),

  planning: (ctx) => `
You are participating in a sprint planning session.

Goal: Define and estimate the work for the upcoming sprint.

As an agent, you should:
1. Review the proposed tasks in the backlog
2. Provide effort estimates (in story points: 1, 2, 3, 5, 8, 13)
3. Identify dependencies or risks
4. Suggest acceptance criteria for complex tasks

Sprint context:
${JSON.stringify(ctx, null, 2)}

Provide structured, actionable output. Format estimates as a table.
`.trim(),

  refinement: (ctx) => `
You are participating in a backlog refinement session.

Goal: Break down, clarify, and prepare backlog items for future sprints.

As an agent, you should:
1. Ask clarifying questions about ambiguous tasks
2. Suggest breaking large tasks into smaller ones
3. Identify missing information or acceptance criteria
4. Flag technical debt or prerequisite work

Backlog context:
${JSON.stringify(ctx, null, 2)}

Be thorough. Better to over-clarify than to under-specify.
`.trim(),

  retro: (ctx) => `
You are participating in a sprint retrospective.

The retro follows the Start / Stop / Continue format:
- **Start**: What should we start doing that we're not doing?
- **Stop**: What should we stop doing that isn't working?
- **Continue**: What is working well and should continue?

Sprint summary:
${JSON.stringify(ctx, null, 2)}

Be honest and constructive. Focus on process improvements, not blame.
`.trim(),

  strategy: (ctx) => `
You are participating in a strategic planning session.

Goal: Align on product direction, priorities, and OKRs.

As an agent, you should:
1. Analyze the current situation and trends
2. Propose strategic initiatives for the next quarter
3. Identify key risks and mitigation strategies
4. Suggest measurable success metrics (OKRs)

Strategic context:
${JSON.stringify(ctx, null, 2)}

Think long-term. Consider market position, competitive landscape, and team capabilities.
`.trim(),
}

// ============================================================
// Resolve API key for a provider from workspace config
// ============================================================

async function resolveApiKey(
  workspaceId: string,
  provider: ModelProviderType
): Promise<string | undefined> {
  const supabase = getSupabaseAdminClient()

  const { data: providerRow } = await supabase
    .from('model_providers')
    .select('encrypted_api_key, iv')
    .eq('workspace_id', workspaceId)
    .eq('provider_type', provider)
    .eq('is_active', true)
    .single()

  if (providerRow?.encrypted_api_key && providerRow?.iv) {
    const decrypted = safeDecryptApiKey(providerRow.encrypted_api_key, providerRow.iv)
    if (decrypted) return decrypted
  }

  const envMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    ollama: undefined,
  }

  return envMap[provider]
}

// ============================================================
// getAgentWithSkills — load agent and build its system prompt
// ============================================================

async function getAgentWithSkills(agentId: string): Promise<{ agent: Agent; systemPrompt: string }> {
  const supabase = getSupabaseAdminClient()

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error || !agent) {
    throw new Error(`Agent not found: ${agentId}`)
  }

  let systemPrompt = (agent as Agent).system_prompt ?? ''

  try {
    const skills = await getAgentSkills(agent as Agent)
    const skillPrompt = buildSkillPrompt(skills)
    if (skillPrompt) systemPrompt += skillPrompt
  } catch {
    // Skills are optional
  }

  return { agent: agent as Agent, systemPrompt }
}

// ============================================================
// runAgentTurn — get a single agent's contribution to a session
// ============================================================

async function runAgentTurn(
  agent: Agent,
  systemPrompt: string,
  sessionPrompt: string,
  priorTranscript: SessionTranscriptEntry[],
  workspaceId: string
): Promise<{ content: string; tokensInput: number; tokensOutput: number; costUsd: number }> {
  // Determine model
  let provider: ModelProviderType
  let modelId: string

  if (agent.model && agent.model.includes(':')) {
    const parsed = parseModelString(agent.model)
    provider = parsed.provider
    modelId = parsed.model
  } else {
    const best = selectBestFreeModel()
    provider = best.provider
    modelId = best.model
  }

  const apiKey = await resolveApiKey(workspaceId, provider)

  // Build message history from prior transcript
  const messages: ModelMessage[] = []

  // System context
  messages.push({
    role: 'user',
    content: sessionPrompt,
  })

  // Include prior contributions for context (as assistant turns from others)
  if (priorTranscript.length > 0) {
    const priorContext = priorTranscript
      .map((entry) => `**${entry.agentName}** (${entry.role}):\n${entry.content}`)
      .join('\n\n---\n\n')

    messages.push({
      role: 'assistant',
      content: `[Session transcript so far]\n\n${priorContext}`,
    })

    messages.push({
      role: 'user',
      content: `Now it's your turn (${agent.name}). Please provide your contribution.`,
    })
  }

  const result = await callModel({
    provider,
    model: modelId,
    messages,
    system: systemPrompt || undefined,
    temperature: agent.config?.temperature ?? 0.7,
    max_tokens: agent.config?.max_tokens ?? 2048,
    api_key: apiKey,
  })

  const costUsd = estimateCost(provider, modelId, result.tokens_input, result.tokens_output)

  return {
    content: result.content,
    tokensInput: result.tokens_input,
    tokensOutput: result.tokens_output,
    costUsd,
  }
}

// ============================================================
// runSession — main entry point
// ============================================================

export async function runSession(params: RunSessionParams): Promise<SessionResult> {
  const supabase = getSupabaseAdminClient()
  const { workspaceId, sessionType, participants, context = {}, sprintId, createdBy } = params

  // Create session record
  const { data: sessionRecord, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      workspace_id: workspaceId,
      session_type: sessionType,
      status: 'active',
      sprint_id: sprintId ?? null,
      context,
      transcript: [],
      created_by: createdBy ?? null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (sessionError || !sessionRecord) {
    throw new Error(`Failed to create session: ${sessionError?.message}`)
  }

  const sessionId = (sessionRecord as { id: string }).id
  const sessionPrompt = SESSION_PROMPTS[sessionType](context)
  const transcript: SessionTranscriptEntry[] = []
  let totalTokens = 0
  let totalCost = 0

  // Run each participant sequentially
  for (const participant of participants) {
    try {
      const { agent, systemPrompt } = await getAgentWithSkills(participant.agentId)

      const turn = await runAgentTurn(
        agent,
        systemPrompt,
        sessionPrompt,
        transcript,
        workspaceId
      )

      const entry: SessionTranscriptEntry = {
        agentId: agent.id,
        agentName: agent.name,
        role: participant.role ?? agent.type,
        content: turn.content,
        tokensInput: turn.tokensInput,
        tokensOutput: turn.tokensOutput,
        costUsd: turn.costUsd,
        timestamp: new Date().toISOString(),
      }

      transcript.push(entry)
      totalTokens += turn.tokensInput + turn.tokensOutput
      totalCost += turn.costUsd

      // Record usage event
      await supabase.from('usage_events').insert({
        workspace_id: workspaceId,
        agent_id: agent.id,
        task_id: null,
        session_id: sessionId,
        event_type: 'llm_tokens',
        quantity: turn.tokensInput + turn.tokensOutput,
        cost_usd: turn.costUsd,
        model: agent.model,
        provider: agent.model?.split(':')[0] ?? null,
        metadata: { session_type: sessionType },
        recorded_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error(`[Session] Agent ${participant.agentId} failed:`, err)
      transcript.push({
        agentId: participant.agentId,
        agentName: 'Unknown Agent',
        role: participant.role ?? 'participant',
        content: `[Error: ${err instanceof Error ? err.message : String(err)}]`,
        tokensInput: 0,
        tokensOutput: 0,
        costUsd: 0,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Generate summary using the first available model
  const summaryPrompt = `
You are a meeting summarizer. Below is the transcript of a ${sessionType} session.

Provide a concise summary (3-5 bullet points) of:
1. Key decisions made
2. Action items identified
3. Blockers or risks raised
4. Next steps

Transcript:
${transcript.map((e) => `**${e.agentName}**: ${e.content}`).join('\n\n')}
`.trim()

  let summary = ''
  try {
    const { provider: sumProvider, model: sumModel } = selectBestFreeModel()
    const sumApiKey = await resolveApiKey(workspaceId, sumProvider)

    const sumResult = await callModel({
      provider: sumProvider,
      model: sumModel,
      messages: [{ role: 'user', content: summaryPrompt }],
      max_tokens: 1024,
      api_key: sumApiKey,
    })

    summary = sumResult.content
    totalTokens += sumResult.tokens_input + sumResult.tokens_output
    totalCost += estimateCost(sumProvider, sumModel, sumResult.tokens_input, sumResult.tokens_output)
  } catch {
    summary = `${sessionType} session completed with ${transcript.length} participants.`
  }

  // Update session record with transcript and summary
  await supabase
    .from('sessions')
    .update({
      status: 'ended',
      transcript,
      summary,
      ended_at: new Date().toISOString(),
      total_tokens: totalTokens,
      total_cost: totalCost,
    })
    .eq('id', sessionId)

  return {
    sessionId,
    transcript,
    summary,
    outputs: {
      session_type: sessionType,
      participant_count: participants.length,
    },
    totalTokens,
    totalCost,
  }
}
