// ============================================================
// Agent OS — Execution Provider Interface
// Unified abstraction over all LLM backends with health checks,
// capability introspection, and rate limit awareness.
// ============================================================

import type { ModelCallOptions, ModelCallResult, ModelProviderType } from '@/lib/types'
import { PROVIDERS, callModel, getModelDefinition } from '@/lib/models/registry'

// ============================================================
// Types
// ============================================================

export interface ProviderHealthResult {
  healthy: boolean
  latency_ms: number
  error?: string
  checked_at: string
}

export interface ProviderCapabilities {
  supports_vision: boolean
  supports_function_calling: boolean
  supports_streaming: boolean
  max_context_window: number
  model_count: number
}

export interface RateLimitInfo {
  remaining_requests: number | null
  remaining_tokens: number | null
  reset_at: string | null
  updated_at: string
}

// ============================================================
// ExecutionProvider — the core interface
// ============================================================

export interface ExecutionProvider {
  readonly type: ModelProviderType
  readonly name: string
  readonly requiresApiKey: boolean

  /**
   * Validate connectivity and API key by making a lightweight call.
   * Returns health result without throwing.
   */
  checkHealth(apiKey?: string): Promise<ProviderHealthResult>

  /**
   * Aggregate capabilities across all models for this provider.
   */
  getCapabilities(): ProviderCapabilities

  /**
   * Execute a model call through this provider.
   * Delegates to the existing provider-specific caller.
   */
  execute(options: ModelCallOptions): Promise<ModelCallResult>

  /**
   * Last known rate limit info (populated after each execute() call).
   */
  getRateLimitStatus(): RateLimitInfo | null
}

// ============================================================
// BaseExecutionProvider — wraps existing callModel dispatch
// ============================================================

class BaseExecutionProvider implements ExecutionProvider {
  readonly type: ModelProviderType
  readonly name: string
  readonly requiresApiKey: boolean

  private _rateLimitInfo: RateLimitInfo | null = null

  constructor(providerType: ModelProviderType) {
    const info = PROVIDERS[providerType]
    if (!info) throw new Error(`Unknown provider: ${providerType}`)
    this.type = providerType
    this.name = info.name
    this.requiresApiKey = info.requiresApiKey
  }

  // ----------------------------------------------------------
  // Health Check
  // ----------------------------------------------------------

  async checkHealth(apiKey?: string): Promise<ProviderHealthResult> {
    const start = Date.now()

    // Ollama: just ping the local server
    if (this.type === 'ollama') {
      try {
        const resp = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(5000),
        })
        return {
          healthy: resp.ok,
          latency_ms: Date.now() - start,
          error: resp.ok ? undefined : `HTTP ${resp.status}`,
          checked_at: new Date().toISOString(),
        }
      } catch (err) {
        return {
          healthy: false,
          latency_ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
          checked_at: new Date().toISOString(),
        }
      }
    }

    // Cloud providers: make a minimal completion request
    if (this.requiresApiKey && !apiKey) {
      return {
        healthy: false,
        latency_ms: 0,
        error: 'No API key configured',
        checked_at: new Date().toISOString(),
      }
    }

    try {
      const models = PROVIDERS[this.type].models
      const cheapest = models.reduce((a, b) =>
        a.input_cost_per_million <= b.input_cost_per_million ? a : b
      )

      await callModel({
        provider: this.type,
        model: cheapest.id,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
        api_key: apiKey,
      })

      return {
        healthy: true,
        latency_ms: Date.now() - start,
        checked_at: new Date().toISOString(),
      }
    } catch (err) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        checked_at: new Date().toISOString(),
      }
    }
  }

  // ----------------------------------------------------------
  // Capabilities
  // ----------------------------------------------------------

  getCapabilities(): ProviderCapabilities {
    const models = PROVIDERS[this.type].models
    return {
      supports_vision: models.some((m) => m.supports_vision),
      supports_function_calling: models.some((m) => m.supports_function_calling),
      supports_streaming: true, // all current providers support streaming
      max_context_window: Math.max(...models.map((m) => m.context_window)),
      model_count: models.length,
    }
  }

  // ----------------------------------------------------------
  // Execute
  // ----------------------------------------------------------

  async execute(options: ModelCallOptions): Promise<ModelCallResult> {
    const result = await callModel(options)

    // Update rate limit info timestamp
    this._rateLimitInfo = {
      remaining_requests: null,
      remaining_tokens: null,
      reset_at: null,
      updated_at: new Date().toISOString(),
    }

    return result
  }

  // ----------------------------------------------------------
  // Rate Limit Status
  // ----------------------------------------------------------

  getRateLimitStatus(): RateLimitInfo | null {
    return this._rateLimitInfo
  }
}

// ============================================================
// Factory — get an ExecutionProvider by type
// ============================================================

const providerCache = new Map<ModelProviderType, ExecutionProvider>()

export function getExecutionProvider(type: ModelProviderType): ExecutionProvider {
  let provider = providerCache.get(type)
  if (!provider) {
    provider = new BaseExecutionProvider(type)
    providerCache.set(type, provider)
  }
  return provider
}

/**
 * Get all registered execution providers.
 */
export function getAllExecutionProviders(): ExecutionProvider[] {
  const types = Object.keys(PROVIDERS) as ModelProviderType[]
  return types.map(getExecutionProvider)
}
