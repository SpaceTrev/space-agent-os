// ============================================================
// GET/POST /api/ops  — generic proxy to Python backend
//
// Forwards to http://localhost:8000/<path> and returns the response.
// Usage from client: fetch('/api/ops?path=health')
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  const path = req.nextUrl.searchParams.get('path') ?? 'health'
  const url = `${BACKEND_URL}/${path}`

  try {
    let body: string | undefined
    if (method === 'POST') {
      body = await req.text()
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? body : undefined,
      // 2 min timeout for long-running dispatch calls
      signal: AbortSignal.timeout(120_000),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return NextResponse.json(
        { error: 'Python backend is not running. Start it with ./boot.sh or: cd apps/core && uv run python -m api.main' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET')
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST')
}
