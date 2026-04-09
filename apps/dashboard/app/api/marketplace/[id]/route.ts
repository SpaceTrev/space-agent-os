// ============================================================
// GET /api/marketplace/[id] — Get single marketplace item
// Public — no auth required
// ============================================================

import { NextResponse } from 'next/server'
import { getMarketplaceItem } from '@/lib/marketplace-data'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const item = getMarketplaceItem(id)

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ item })
}
