/**
 * /api/ops — proxy to the Space-Claw FastAPI backend.
 *
 * Usage (from the client):
 *   fetch('/api/ops?path=health')
 *   fetch('/api/ops?path=dispatch', { method: 'POST', body: JSON.stringify({...}) })
 *
 * The `path` query param maps 1-to-1 to a FastAPI route.
 * Set NEXT_PUBLIC_API_URL in Vercel env vars to point at the Railway deployment.
 */

import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'https://roof-christopher-dare-plain.trycloudflare.com'

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  const path = req.nextUrl.searchParams.get('path') ?? ''
  const upstream = `${API_BASE}/${path}`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const body = method !== 'GET' && method !== 'HEAD'
      ? await req.text()
      : undefined

    const res = await fetch(upstream, {
      method,
      headers,
      body,
      // Don't cache — mission control polls every 10 s
      cache: 'no-store',
    })

    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upstream unavailable'
    return NextResponse.json({ error: message, upstream }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET')
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST')
}
