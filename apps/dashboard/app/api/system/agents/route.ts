import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'public', 'system-agents.json')
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ agents: [], count: 0 })
  }
}
