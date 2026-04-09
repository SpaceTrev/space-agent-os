// ============================================================
// GET /api/marketplace — List marketplace items
// Query params: category, search
// Public — no auth required
// ============================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MARKETPLACE_ITEMS, filterByCategory, searchItems } from '@/lib/marketplace-data'
import { FILTER_TABS } from '@/lib/marketplace-types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tab = searchParams.get('tab') ?? 'all'
  const search = searchParams.get('search') ?? ''

  const filterTab = FILTER_TABS.find((t) => t.id === tab) ?? FILTER_TABS[0]
  let items = filterByCategory(MARKETPLACE_ITEMS, filterTab.categories)
  items = searchItems(items, search)

  return NextResponse.json({ items, total: items.length })
}
