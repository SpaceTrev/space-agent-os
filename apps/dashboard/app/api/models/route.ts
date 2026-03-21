// ============================================================
// GET  /api/models?workspace_id=xxx  — get configured providers
// POST /api/models                   — add/update a provider config
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, requireWorkspaceAccessById, toErrorResponse } from '@/lib/auth'
import { encryptApiKey, maskApiKey } from '@/lib/encryption'
import { PROVIDERS } from '@/lib/models/registry'
import type { ModelProviderType } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const workspaceId = req.nextUrl.searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    await requireWorkspaceAccessById(workspaceId, user.id, 'viewer')

    const supabase = await getSupabaseServerClient()

    const { data: providers, error } = await supabase
      .from('model_providers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('provider_type', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mask API keys in response — never send encrypted key back
    const safeProviders = (providers ?? []).map((p: {
      encrypted_api_key: string | null;
      iv: string | null;
      [key: string]: unknown;
    }) => ({
      ...p,
      encrypted_api_key: undefined,
      iv: undefined,
      has_api_key: !!(p.encrypted_api_key && p.iv),
    }))

    return NextResponse.json({ providers: safeProviders })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { workspace_id, provider_type, api_key, base_url, display_name } = body

    if (!workspace_id || !provider_type) {
      return NextResponse.json({ error: 'workspace_id and provider_type are required' }, { status: 400 })
    }

    const validProviders = Object.keys(PROVIDERS)
    if (!validProviders.includes(provider_type)) {
      return NextResponse.json(
        { error: `Invalid provider_type. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    await requireWorkspaceAccessById(workspace_id, user.id, 'admin')

    const supabase = await getSupabaseServerClient()

    // Encrypt the API key if provided
    let encryptedApiKey: string | null = null
    let iv: string | null = null

    if (api_key) {
      const encrypted = encryptApiKey(api_key)
      encryptedApiKey = encrypted.encrypted_api_key
      iv = encrypted.iv
    }

    const providerInfo = PROVIDERS[provider_type as ModelProviderType]

    const upsertData = {
      workspace_id,
      provider_type,
      display_name: display_name ?? providerInfo.name,
      base_url: base_url ?? providerInfo.baseUrl,
      is_active: true,
      is_verified: false,
      available_models: providerInfo.models,
      updated_at: new Date().toISOString(),
      ...(encryptedApiKey !== null && { encrypted_api_key: encryptedApiKey, iv }),
    }

    const { data: existing } = await supabase
      .from('model_providers')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('provider_type', provider_type)
      .single()

    let provider
    let providerError

    if (existing) {
      const { data, error } = await supabase
        .from('model_providers')
        .update(upsertData)
        .eq('id', (existing as { id: string }).id)
        .select()
        .single()
      provider = data
      providerError = error
    } else {
      const { data, error } = await supabase
        .from('model_providers')
        .insert({ ...upsertData, created_at: new Date().toISOString() })
        .select()
        .single()
      provider = data
      providerError = error
    }

    if (providerError) {
      return NextResponse.json({ error: providerError.message }, { status: 500 })
    }

    // Return safe version (no encrypted key)
    return NextResponse.json({
      provider: {
        ...(provider as Record<string, unknown>),
        encrypted_api_key: undefined,
        iv: undefined,
        has_api_key: !!encryptedApiKey,
        api_key_preview: api_key ? maskApiKey(api_key) : null,
      },
    })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const workspaceId = req.nextUrl.searchParams.get('workspace_id')
    const providerType = req.nextUrl.searchParams.get('provider_type')

    if (!workspaceId || !providerType) {
      return NextResponse.json(
        { error: 'workspace_id and provider_type are required' },
        { status: 400 }
      )
    }

    await requireWorkspaceAccessById(workspaceId, user.id, 'admin')

    const supabase = await getSupabaseServerClient()

    const { error } = await supabase
      .from('model_providers')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider_type', providerType)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true, provider_type: providerType })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
