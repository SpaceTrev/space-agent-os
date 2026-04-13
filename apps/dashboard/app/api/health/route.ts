import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Try Supabase first
  if (url && key && !url.includes('127.0.0.1')) {
    try {
      const sb = createClient(url, key)
      const { data: state } = await sb.from('system_state').select('*').eq('id', 'singleton').single()
      const { data: agents } = await sb.from('agent_status').select('*')
      const { data: models } = await sb.from('model_status').select('*')
      return NextResponse.json({
        ...state?.health,
        _source: 'supabase',
        _agents: agents?.length ?? 0,
        _models: models?.length ?? 0,
        _synced_at: state?.updated_at,
      })
    } catch (e) {
      // Fall through to static
    }
  }

  // Fallback: static
  return NextResponse.json({
    status: 'online',
    system: 'Space-Agent-OS',
    _source: 'static',
    agents_total: 9,
    model_tiers: 4,
    brain_domains: 6,
    deployment: 'vercel',
  })
}
