// ============================================================
// Agent OS — Model Registry
// Central routing layer for all LLM providers
// ============================================================

import type { ModelCallOptions, ModelCallResult, ModelDefinition, ModelProviderType } from '@/lib/types'
import { callAnthropicModel } from './anthropic'
import { callGeminiModel } from './gemini'
import { callGroqModel } from './groq'
import { callMistralModel } from './mistral'
import { callPerplexityModel } from './perplexity'
import { callOpenRouterModel } from './openrouter'
import { callOllamaModel } from './ollama'

// ============================================================
// Provider definitions with their available models
// ============================================================

export const PROVIDERS: Record<
  ModelProviderType,
  {
    name: string
    baseUrl: string
    models: ModelDefinition[]
    requiresApiKey: boolean
  }
> = {
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    requiresApiKey: true,
    models: [
      {
        id: 'claude-opus-4-5',
        name: 'Claude Opus 4.5',
        provider: 'anthropic',
        context_window: 200000,
        max_output_tokens: 8192,
        input_cost_per_million: 15.0,
        output_cost_per_million: 75.0,
        supports_vision: true,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        provider: 'anthropic',
        context_window: 200000,
        max_output_tokens: 8192,
        input_cost_per_million: 3.0,
        output_cost_per_million: 15.0,
        supports_vision: true,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'claude-haiku-3-5',
        name: 'Claude Haiku 3.5',
        provider: 'anthropic',
        context_window: 200000,
        max_output_tokens: 8192,
        input_cost_per_million: 0.8,
        output_cost_per_million: 4.0,
        supports_vision: true,
        supports_function_calling: true,
        is_free: false,
      },
    ],
  },

  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    requiresApiKey: true,
    models: [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Experimental)',
        provider: 'gemini',
        context_window: 1048576,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: true,
        supports_function_calling: true,
        is_free: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        context_window: 2097152,
        max_output_tokens: 8192,
        input_cost_per_million: 1.25,
        output_cost_per_million: 5.0,
        supports_vision: true,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        context_window: 1048576,
        max_output_tokens: 8192,
        input_cost_per_million: 0.075,
        output_cost_per_million: 0.3,
        supports_vision: true,
        supports_function_calling: true,
        is_free: false,
      },
    ],
  },

  perplexity: {
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    requiresApiKey: true,
    models: [
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Sonar Large (Online)',
        provider: 'perplexity',
        context_window: 127072,
        max_output_tokens: 8192,
        input_cost_per_million: 1.0,
        output_cost_per_million: 1.0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: false,
      },
      {
        id: 'llama-3.1-sonar-small-128k-online',
        name: 'Sonar Small (Online)',
        provider: 'perplexity',
        context_window: 127072,
        max_output_tokens: 8192,
        input_cost_per_million: 0.2,
        output_cost_per_million: 0.2,
        supports_vision: false,
        supports_function_calling: false,
        is_free: false,
      },
      {
        id: 'llama-3.1-sonar-huge-128k-online',
        name: 'Sonar Huge (Online)',
        provider: 'perplexity',
        context_window: 127072,
        max_output_tokens: 8192,
        input_cost_per_million: 5.0,
        output_cost_per_million: 5.0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: false,
      },
    ],
  },

  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        provider: 'groq',
        context_window: 128000,
        max_output_tokens: 32768,
        input_cost_per_million: 0.59,
        output_cost_per_million: 0.79,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        context_window: 128000,
        max_output_tokens: 8000,
        input_cost_per_million: 0.05,
        output_cost_per_million: 0.08,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        context_window: 32768,
        max_output_tokens: 32768,
        input_cost_per_million: 0.24,
        output_cost_per_million: 0.24,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B IT',
        provider: 'groq',
        context_window: 8192,
        max_output_tokens: 8192,
        input_cost_per_million: 0.2,
        output_cost_per_million: 0.2,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
    ],
  },

  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        provider: 'mistral',
        context_window: 128000,
        max_output_tokens: 8192,
        input_cost_per_million: 2.0,
        output_cost_per_million: 6.0,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        provider: 'mistral',
        context_window: 128000,
        max_output_tokens: 8192,
        input_cost_per_million: 0.2,
        output_cost_per_million: 0.6,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
      {
        id: 'open-mistral-nemo',
        name: 'Mistral Nemo (Free)',
        provider: 'mistral',
        context_window: 128000,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: true,
        is_free: true,
      },
      {
        id: 'codestral-latest',
        name: 'Codestral',
        provider: 'mistral',
        context_window: 32000,
        max_output_tokens: 8192,
        input_cost_per_million: 0.2,
        output_cost_per_million: 0.6,
        supports_vision: false,
        supports_function_calling: true,
        is_free: false,
      },
    ],
  },

  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B Instruct (Free)',
        provider: 'openrouter',
        context_window: 131072,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
      {
        id: 'mistralai/mistral-7b-instruct:free',
        name: 'Mistral 7B Instruct (Free)',
        provider: 'openrouter',
        context_window: 32768,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
      {
        id: 'google/gemma-2-9b-it:free',
        name: 'Gemma 2 9B IT (Free)',
        provider: 'openrouter',
        context_window: 8192,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'openrouter',
        context_window: 128000,
        max_output_tokens: 16384,
        input_cost_per_million: 2.5,
        output_cost_per_million: 10.0,
        supports_vision: true,
        supports_function_calling: true,
        is_free: false,
      },
    ],
  },

  ollama: {
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    models: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2 (Local)',
        provider: 'ollama',
        context_window: 128000,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
      {
        id: 'mistral',
        name: 'Mistral (Local)',
        provider: 'ollama',
        context_window: 32768,
        max_output_tokens: 8192,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
      {
        id: 'codellama',
        name: 'CodeLlama (Local)',
        provider: 'ollama',
        context_window: 16384,
        max_output_tokens: 4096,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
      {
        id: 'phi3',
        name: 'Phi-3 (Local)',
        provider: 'ollama',
        context_window: 128000,
        max_output_tokens: 4096,
        input_cost_per_million: 0,
        output_cost_per_million: 0,
        supports_vision: false,
        supports_function_calling: false,
        is_free: true,
      },
    ],
  },
}

// ============================================================
// Get all models as a flat list
// ============================================================

export function getAllModels(): ModelDefinition[] {
  return Object.values(PROVIDERS).flatMap((p) => p.models)
}

// ============================================================
// Get a specific model definition by provider:model-id
// ============================================================

export function getModelDefinition(
  providerType: ModelProviderType,
  modelId: string
): ModelDefinition | undefined {
  return PROVIDERS[providerType]?.models.find((m) => m.id === modelId)
}

// ============================================================
// Select the best free model available (prioritized list)
// ============================================================

export function selectBestFreeModel(): { provider: ModelProviderType; model: string } {
  // Priority order for free models
  const priorities: Array<{ provider: ModelProviderType; model: string }> = [
    { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
    { provider: 'mistral', model: 'open-mistral-nemo' },
    { provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free' },
    { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
    { provider: 'openrouter', model: 'google/gemma-2-9b-it:free' },
    { provider: 'ollama', model: 'llama3.2' },
  ]

  for (const candidate of priorities) {
    const providerInfo = PROVIDERS[candidate.provider]
    const modelDef = providerInfo.models.find((m) => m.id === candidate.model)
    if (modelDef?.is_free) {
      return candidate
    }
  }

  // Ultimate fallback — Ollama local
  return { provider: 'ollama', model: 'llama3.2' }
}

// ============================================================
// Estimate cost for a call
// ============================================================

export function estimateCost(
  providerType: ModelProviderType,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModelDefinition(providerType, modelId)
  if (!model) return 0
  const inputCost = (inputTokens / 1_000_000) * model.input_cost_per_million
  const outputCost = (outputTokens / 1_000_000) * model.output_cost_per_million
  return inputCost + outputCost
}

// ============================================================
// Main callModel router — dispatches to the right provider
// ============================================================

export async function callModel(options: ModelCallOptions): Promise<ModelCallResult> {
  const { provider } = options

  switch (provider) {
    case 'anthropic':
      return callAnthropicModel(options)

    case 'gemini':
      return callGeminiModel(options)

    case 'groq':
      return callGroqModel(options)

    case 'mistral':
      return callMistralModel(options)

    case 'perplexity':
      return callPerplexityModel(options)

    case 'openrouter':
      return callOpenRouterModel(options)

    case 'ollama':
      return callOllamaModel(options)

    default: {
      const exhaustive: never = provider
      throw new Error(`Unknown model provider: ${exhaustive}`)
    }
  }
}

// ============================================================
// Parse a "provider:model" string
// ============================================================

export function parseModelString(modelStr: string): {
  provider: ModelProviderType
  model: string
} {
  const colonIdx = modelStr.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`Invalid model string "${modelStr}". Expected "provider:model-id" format.`)
  }
  const provider = modelStr.slice(0, colonIdx) as ModelProviderType
  const model = modelStr.slice(colonIdx + 1)
  if (!PROVIDERS[provider]) {
    throw new Error(`Unknown provider "${provider}" in model string "${modelStr}"`)
  }
  return { provider, model }
}
