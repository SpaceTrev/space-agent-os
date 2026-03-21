// ============================================================
// GET /api/models/available — returns all models from registry
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAllModels, PROVIDERS } from '@/lib/models/registry'
import { requireAuth, toErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    const allModels = getAllModels()

    // Group by provider
    const byProvider = Object.entries(PROVIDERS).map(([providerKey, providerInfo]) => ({
      provider: providerKey,
      name: providerInfo.name,
      base_url: providerInfo.baseUrl,
      requires_api_key: providerInfo.requiresApiKey,
      models: providerInfo.models,
    }))

    // Separate free and paid models
    const freeModels = allModels.filter((m) => m.is_free)
    const paidModels = allModels.filter((m) => !m.is_free)

    // Picker-ready shape — camelCase fields matching ModelPicker component
    const pickerModels = allModels.map((m) => ({
      id: `${m.provider}:${m.id}`,
      name: m.name,
      provider: m.provider,
      providerName: PROVIDERS[m.provider]?.name ?? m.provider,
      contextWindow: m.context_window,
      isFree: m.is_free,
      inputCostPerMillion: m.input_cost_per_million,
    }))

    return NextResponse.json({
      providers: byProvider,
      models: allModels,
      free_models: freeModels,
      paid_models: paidModels,
      picker_models: pickerModels,
      total_count: allModels.length,
      free_count: freeModels.length,
    })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
