// ============================================================
// Agent OS — Provider Chain
// Orchestrates model execution with fallback logic + retry.
// Resolves: agent model → workspace default → best free model.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/db'
import { safeDecryptApiKey } from '@/lib/encryption'
import { parseModelString, selectBestFreeModel } from '@/lib/models/registry'
import { getExecutionProvider } from './execution-provider'
import type { ModelCallOptions, ModelCallResult, ModelMessage, ModelProviderType } from '@/lib/types'
import type { ExecutionProvider, ProviderHealthResult } from './execution-provider'

// ============================================================
// Types
// ============================================================

export interface ChainAttempt {
  provider: ModelProviderType
  model: string
  success: boolean
  error?: string
  duration_ms: number
}

export interface ChainResult {
  result: ModelCallResult
  provider: ModelProviderType
  model: string
  attempts: ChainAttempt[]
  api_key_source: 'workspace' | 'env' | 'none'
}

export interface ChainOptions {
  /** Workspace ID (used to resolve API keys) */
  workspaceId: string
  /** Agent-specified model string (e.g. "anthropic:claude-sonnet-4-5") */
  agentModel: string | null
  /** Messages to send */
  messages: ModelMessage[]
  /** System prompt */
  system?: string
  /** Temperature (default 0.7) */
  temperature?: number
  /** Max output tokens (default 4096) */
  max_tokens?: number
  /** Enable streaming (default false) */
  stream?: boolean
  /** Max retry attempts per provider (default 2) */
  maxRetries?: number
  /** Delay between retries in ms (default 1000) */
  retryDelayMs?: number
  /** Optional log callback for structured logging */
  onLog?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void
}

// ============================================================
// Resolve API key for a provider from workspace or env
// ============================================================

async function resolveApiKey(
  workspaceId: string,
  provider: ModelProviderType
): Promise<{ key: string | undefined; source: 'workspace' | 'env' | 'none' }> {
  const supabase = getSupabaseAdminClient()

  // 1. Check workspace-level model_providers table
  const { data: providerRow } = await supabase
    .from('model_providers')
    .select('encrypted_api_key, iv')
    .eq('workspace_id', workspaceId)
    .eq('provider_type', provider)
    .eq('is_active', true)
    .single()

  if (providerRow?.encrypted_api_key && providerRow?.iv) {
    const decrypted = safeDecryptApiKey(providerRow.encrypted_api_key, providerRow.iv)
    if (decrypted) return { key: decrypted, source: 'workspace' }
  }

  // 2. Fall back to environment variables
  const envMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    ollama: undefined,
  }

  const envKey = envMap[provider]
  if (envKey) return { key: envKey, source: 'env' }

  return { key: undefined, source: 'none' }
}

// ============================================================
// Sleep helper
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// ProviderChain — resolve + execute with fallback
// ============================================================

export async function executeWithChain(options: ChainOptions): Promise<ChainResult> {
  const {
    workspaceId,
    agentModel,
    messages,
    system,
    temperature = 0.7,
    max_tokens = 4096,
    stream = false,
    maxRetries = 2,
    retryDelayMs = 1000,
    onLog,
  } = options

  const log = onLog ?? (() => {})
  const attempts: ChainAttempt[] = []

  // ----------------------------------------------------------
  // Build the candidate chain
  // ----------------------------------------------------------

  const candidates: Array<{ provider: ModelProviderType; model: string }> = []

  // 1. Agent-specified model
  if (agentModel && agentModel.includes(':')) {
    try {
      const parsed = parseModelString(agentModel)
      candidates.push(parsed)
    } catch {
      log('warn', `Invalid agent model string: "${agentModel}", skipping`)
    }
  }

  // 2. Best free model as fallback
  const bestFree = selectBestFreeModel()
  // Only add if different from the primary
  if (
    candidates.length === 0 ||
    candidates[0].provider !== bestFree.provider ||
    candidates[0].model !== bestFree.model
  ) {
    candidates.push(bestFree)
  }

  log('info', `Execution chain: ${candidates.map((c) => `${c.provider}:${c.model}`).join(' → ')}`)

  // ----------------------------------------------------------
  // Try each candidate with retries
  // ----------------------------------------------------------

  let lastApiKeySource: 'workspace' | 'env' | 'none' = 'none'

  for (const candidate of candidates) {
    const executionProvider = getExecutionProvider(candidate.provider)
    const { key: apiKey, source } = await resolveApiKey(workspaceId, candidate.provider)
    lastApiKeySource = source

    // Skip if cloud provider requires key and we don't have one
    if (executionProvider.requiresApiKey && !apiKey) {
      log('warn', `No API key for ${candidate.provider}, skipping`)
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        success: false,
        error: 'No API key available',
        duration_ms: 0,
      })
      continue
    }

    const callOptions: ModelCallOptions = {
      provider: candidate.provider,
      model: candidate.model,
      messages,
      system,
      temperature,
      max_tokens,
      stream,
      api_key: apiKey,
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now()

      try {
        if (attempt > 0) {
          log('info', `Retry ${attempt}/${maxRetries} for ${candidate.provider}:${candidate.model}`)
          await sleep(retryDelayMs * attempt) // exponential-ish backoff
        }

        log('info', `Calling ${candidate.provider}:${candidate.model}`, {
          attempt: attempt + 1,
          max_retries: maxRetries,
        })

        const result = await executionProvider.execute(callOptions)
        const durationMs = Date.now() - start

        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          success: true,
          duration_ms: durationMs,
        })

        log('info', `Model responded (${result.tokens_input}in / ${result.tokens_output}out) in ${durationMs}ms`)

        return {
          result,
          provider: candidate.provider,
          model: candidate.model,
          attempts,
          api_key_source: lastApiKeySource,
        }
      } catch (err) {
        const durationMs = Date.now() - start
        const errorMsg = err instanceof Error ? err.message : String(err)

        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          success: false,
          error: errorMsg,
          duration_ms: durationMs,
        })

        log('warn', `Attempt ${attempt + 1} failed for ${candidate.provider}:${candidate.model}: ${errorMsg}`)

        // Don't retry on auth errors — move to next provider
        if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Invalid API')) {
          log('warn', `Auth error for ${candidate.provider}, moving to next provider`)
          break
        }
      }
    }
  }

  // ----------------------------------------------------------
  // All candidates exhausted
  // ----------------------------------------------------------

  const errorSummary = attempts
    .filter((a) => !a.success)
    .map((a) => `${a.provider}:${a.model} → ${a.error}`)
    .join('; ')

  throw new Error(`All execution providers failed. Attempts: ${errorSummary}`)
}

// ============================================================
// Convenience: check health for all workspace providers
// ============================================================

export async function checkAllProviderHealth(
  workspaceId: string
): Promise<Array<{ provider: ModelProviderType; health: ProviderHealthResult }>> {
  const providers: ModelProviderType[] = [
    'anthropic', 'gemini', 'groq', 'mistral', 'perplexity', 'openrouter', 'ollama',
  ]

  const results = await Promise.allSettled(
    providers.map(async (type) => {
      const ep = getExecutionProvider(type)
      const { key } = await resolveApiKey(workspaceId, type)
      const health = await ep.checkHealth(key)
      return { provider: type, health }
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<{ provider: ModelProviderType; health: ProviderHealthResult }> =>
      r.status === 'fulfilled'
    )
    .map((r) => r.value)
}
