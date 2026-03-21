// ============================================================
// POST /api/models/health — validate a provider API key
// Sends a minimal request to the provider and checks response
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'
import { safeDecryptApiKey } from '@/lib/encryption'
import { PROVIDERS } from '@/lib/models/registry'
import type { ModelProviderType } from '@/lib/types'

// Provider-specific health check URLs + minimal request shapes
const HEALTH_CHECKS: Record<
  ModelProviderType,
  {
    url: string
    buildRequest: (apiKey: string) => { headers: Record<string, string>; body?: string; method: string }
  }
> = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    buildRequest: (apiKey) => ({
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-3-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }),
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    buildRequest: (apiKey) => ({
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
    }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    buildRequest: (apiKey) => ({
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/models',
    buildRequest: (apiKey) => ({
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
    buildRequest: (apiKey) => ({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    }),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    buildRequest: (apiKey) => ({
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
  ollama: {
    url: 'http://localhost:11434/api/tags',
    buildRequest: () => ({
      method: 'GET',
      headers: {},
    }),
  },
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const { workspace_id, provider_type } = body

    if (!workspace_id || !provider_type) {
      return NextResponse.json(
        { error: 'workspace_id and provider_type are required' },
        { status: 400 }
      )
    }

    if (!PROVIDERS[provider_type as ModelProviderType]) {
      return NextResponse.json({ error: `Unknown provider: ${provider_type}` }, { status: 400 })
    }

    await requireWorkspaceAccessById(workspace_id, user.id, 'viewer')

    const supabase = await getSupabaseServerClient()

    // Fetch stored credentials
    const { data: provider, error: dbError } = await supabase
      .from('model_providers')
      .select('encrypted_api_key, iv, is_active')
      .eq('workspace_id', workspace_id)
      .eq('provider_type', provider_type)
      .single()

    if (dbError || !provider) {
      return NextResponse.json(
        { healthy: false, error: 'Provider not configured for this workspace' },
        { status: 404 }
      )
    }

    const typedProvider = provider as {
      encrypted_api_key: string | null
      iv: string | null
      is_active: boolean
    }

    // Decrypt the API key
    const apiKey = safeDecryptApiKey(typedProvider.encrypted_api_key, typedProvider.iv)

    const providerKey = provider_type as ModelProviderType
    const healthCheck = HEALTH_CHECKS[providerKey]

    if (!apiKey && PROVIDERS[providerKey].requiresApiKey) {
      return NextResponse.json(
        { healthy: false, error: 'No API key stored for this provider' },
        { status: 200 }
      )
    }

    // Send a minimal health-check request
    const startMs = Date.now()
    try {
      const reqConfig = healthCheck.buildRequest(apiKey ?? '')
      const response = await fetch(healthCheck.url, {
        method: reqConfig.method,
        headers: reqConfig.headers,
        body: reqConfig.body,
        signal: AbortSignal.timeout(10_000),
      })

      const latencyMs = Date.now() - startMs

      if (response.ok || response.status === 200) {
        // Mark as verified in the DB
        await supabase
          .from('model_providers')
          .update({ is_verified: true, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspace_id)
          .eq('provider_type', provider_type)

        return NextResponse.json({
          healthy: true,
          latency_ms: latencyMs,
          provider: provider_type,
        })
      }

      // Non-200 response — likely bad key or rate limited
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json({
        healthy: false,
        status: response.status,
        latency_ms: latencyMs,
        error: response.status === 401 || response.status === 403
          ? 'Invalid or expired API key'
          : `Provider returned ${response.status}`,
        detail: errorText.slice(0, 200),
      })
    } catch (fetchErr) {
      const latencyMs = Date.now() - startMs
      return NextResponse.json({
        healthy: false,
        latency_ms: latencyMs,
        error: fetchErr instanceof Error ? fetchErr.message : 'Connection failed',
      })
    }
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
