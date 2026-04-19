'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { ProviderConfig } from '../../../../components/models/provider-config'
import { ModelPicker } from '../../../../components/models/model-picker'
import { Brain, Plus, GitMerge, ArrowRight, Activity, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/lib/auth-context'
import type { ModelProviderType, ModelDefinition } from '../../../../lib/types'

// ― Static list of ALL known providers (from registry) ―
// We merge DB state into this so unconfigured providers still show
const KNOWN_PROVIDERS: {
  providerType: ModelProviderType
  displayName: string
  logoChar: string
  docsUrl?: string
}[] = [
  { providerType: 'anthropic', displayName: 'Anthropic', logoChar: 'A', docsUrl: 'https://console.anthropic.com/api-keys' },
  { providerType: 'gemini', displayName: 'Google Gemini', logoChar: 'G', docsUrl: 'https://aistudio.google.com/app/apikey' },
  { providerType: 'groq', displayName: 'Groq', logoChar: 'G', docsUrl: 'https://console.groq.com/keys' },
  { providerType: 'perplexity', displayName: 'Perplexity', logoChar: 'P', docsUrl: 'https://docs.perplexity.ai/guides/getting-started' },
  { providerType: 'mistral', displayName: 'Mistral AI', logoChar: 'M', docsUrl: 'https://console.mistral.ai/api-keys/' },
  { providerType: 'openrouter', displayName: 'OpenRouter', logoChar: 'R', docsUrl: 'https://openrouter.ai/keys' },
  { providerType: 'ollama', displayName: 'Ollama (Local)', logoChar: 'O' },
]

interface ProviderRecord {
  id: string
  provider_type: ModelProviderType
  display_name: string
  is_active: boolean
  is_verified: boolean
  has_api_key: boolean
  available_models: ModelDefinition[] | null
  base_url: string | null
}

interface HealthResult {
  provider: ModelProviderType
  healthy: boolean
  latency_ms?: number
  error?: string
  loading: boolean
}

const mockRoutingRules = [
  { id: '1', name: 'High Priority Tasks', condition: 'Priority == Critical', model: 'anthropic:claude-sonnet-4-5', isActive: true },
  { id: '2', name: 'Data Analysis', condition: 'Category == Analysis', model: 'groq:llama-3.3-70b-versatile', isActive: true },
  { id: '3', name: 'Web Research', condition: 'Requires Internet == True', model: 'perplexity:llama-3.1-sonar-large-128k-online', isActive: true },
  { id: '4', name: 'Nightly Batch Jobs', condition: 'Cost Sensitivity == High', model: 'groq:llama-3.1-8b-instant', isActive: false },
]

export default function ModelsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [providers, setProviders] = useState<ProviderRecord[]>([])
  const [defaultModel, setDefaultModel] = useState('anthropic:claude-sonnet-4-5')
  const [pageLoading, setPageLoading] = useState(true)
  const [healthResults, setHealthResults] = useState<Record<string, HealthResult>>({})

  const ws = workspaces.find((w) => w.slug === workspace)

  // ― Load configured providers from API ―
  const loadProviders = useCallback(async () => {
    if (!ws) return
    try {
      const res = await fetch(`/api/models?workspace_id=${ws.id}`)
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers ?? [])
      }
    } catch {
      // Fail silently — empty state will show
    } finally {
      setPageLoading(false)
    }
  }, [ws])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  // ― Save / upsert a provider ―
  const handleSaveProvider = async (
    providerType: ModelProviderType,
    data: { apiKey?: string; defaultModel?: string; isActive: boolean }
  ) => {
    if (!ws) return
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: ws.id,
        provider_type: providerType,
        api_key: data.apiKey || undefined,
        is_active: data.isActive,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to save provider')
    }
    // Refresh list
    await loadProviders()
  }

  // ― Health-check a provider ―
  const handleHealthCheck = async (providerType: ModelProviderType) => {
    if (!ws) return
    setHealthResults((prev) => ({
      ...prev,
      [providerType]: { provider: providerType, healthy: false, loading: true },
    }))

    try {
      const res = await fetch('/api/models/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: ws.id, provider_type: providerType }),
      })
      const data = await res.json()
      setHealthResults((prev) => ({
        ...prev,
        [providerType]: {
          provider: providerType,
          healthy: data.healthy ?? false,
          latency_ms: data.latency_ms,
          error: data.error,
          loading: false,
        },
      }))
    } catch {
      setHealthResults((prev) => ({
        ...prev,
        [providerType]: { provider: providerType, healthy: false, error: 'Network error', loading: false },
      }))
    }
  }

  // ― Merge known providers + DB state ―
  const mergedProviders = KNOWN_PROVIDERS.map((known) => {
    const dbRow = providers.find((p) => p.provider_type === known.providerType)
    return {
      providerType: known.providerType,
      displayName: dbRow?.display_name ?? known.displayName,
      logoChar: known.logoChar,
      isActive: dbRow?.is_active ?? false,
      isVerified: dbRow?.is_verified ?? false,
      hasApiKey: dbRow?.has_api_key ?? false,
      availableModels: (dbRow?.available_models ?? []).map((m: ModelDefinition) => ({
        id: `${known.providerType}:${m.id}`,
        name: m.name,
        isFree: m.is_free ?? false,
      })),
      docsUrl: known.docsUrl,
    }
  })

  // Build all-models list for model picker
  const allModels = mergedProviders.flatMap((p) =>
    p.availableModels.map((m) => ({
      ...m,
      provider: p.providerType,
      providerName: p.displayName,
      contextWindow: 128000,
      inputCostPerMillion: m.isFree ? 0 : 1.5,
    }))
  )

  const verifiedCount = mergedProviders.filter((p) => p.isVerified).length
  const configuredCount = mergedProviders.filter((p) => p.hasApiKey).length

  if (pageLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-surface-high border border-outline-variant flex items-center justify-center">
          <Brain className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Model Providers</h1>
          <p className="text-sm text-on-surface-variant">
            {verifiedCount} verified · {configuredCount} configured of {KNOWN_PROVIDERS.length} providers
          </p>
        </div>
      </div>

      {/* Workspace default model */}
      <div className="bg-surface-base border border-outline-variant rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-on-surface mb-1">Workspace Default Model</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Used when an agent doesn&apos;t have a specific model configured.
        </p>
        <ModelPicker
          models={allModels}
          value={defaultModel}
          onChange={setDefaultModel}
        />
      </div>

      {/* Routing Rules Engine */}
      <div className="bg-surface-base border border-outline-variant rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-on-surface mb-1">Routing Rules Engine</h2>
            <p className="text-xs text-on-surface-variant">
              Dynamically route tasks to different active models based on context.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 text-xs font-medium rounded transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>

        <div className="space-y-3">
          {mockRoutingRules.map(rule => (
            <div key={rule.id} className={clsx("flex items-center gap-4 px-4 py-3 border rounded-lg", rule.isActive ? "border-brand-500/30 bg-surface-high/50" : "border-outline-variant bg-surface-base opacity-60")}>
              <GitMerge className={clsx("w-4 h-4", rule.isActive ? "text-brand-400" : "text-on-surface-variant")} />
              <div className="flex-1">
                <p className="text-sm font-medium text-on-surface">{rule.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-on-surface-variant bg-surface-base px-1.5 py-0.5 rounded border border-outline-variant">{rule.condition}</span>
                  <ArrowRight className="w-3 h-3 text-on-surface-variant" />
                  <span className="text-xs font-mono text-brand-400/80">{rule.model.split(':').pop()}</span>
                </div>
              </div>
              <div className={clsx("text-xs font-medium px-2 py-1 rounded-md", rule.isActive ? "bg-green-500/10 text-green-400" : "bg-surface-high text-on-surface-variant")}>
                {rule.isActive ? 'Active' : 'Disabled'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider configs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Configured Providers</h2>
        </div>
        {mergedProviders.map((provider) => {
          const health = healthResults[provider.providerType]
          return (
            <div key={provider.providerType}>
              <ProviderConfig
                providerType={provider.providerType}
                displayName={provider.displayName}
                logoChar={provider.logoChar}
                isActive={provider.isActive}
                isVerified={provider.isVerified}
                hasApiKey={provider.hasApiKey}
                availableModels={provider.availableModels}
                docsUrl={provider.docsUrl}
                onSave={(data) => handleSaveProvider(provider.providerType, data)}
              />
              {/* Health-check row (shown after save when provider has a key) */}
              {provider.hasApiKey && (
                <div className="flex items-center gap-3 mt-1 ml-14 text-xs">
                  <button
                    onClick={() => handleHealthCheck(provider.providerType)}
                    className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-brand-400 transition-colors"
                    disabled={health?.loading}
                  >
                    {health?.loading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Activity className="w-3 h-3" />
                    )}
                    Test Connection
                  </button>
                  {health && !health.loading && (
                    <span className={clsx(
                      "flex items-center gap-1",
                      health.healthy ? "text-green-400" : "text-red-400"
                    )}>
                      <span className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        health.healthy ? "bg-green-400" : "bg-red-400"
                      )} />
                      {health.healthy
                        ? `Connected (${health.latency_ms}ms)`
                        : health.error || 'Connection failed'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
