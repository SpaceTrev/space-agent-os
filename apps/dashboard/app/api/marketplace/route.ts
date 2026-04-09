// apps/dashboard/app/api/marketplace/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { marketplaceItems } from '@/lib/marketplace-data';
import type { MarketplaceCategory } from '@/lib/marketplace-types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const category = searchParams.get('category') as MarketplaceCategory | 'all' | null;
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const tier = searchParams.get('tier');
  const sort = searchParams.get('sort') ?? 'popular'; // popular | rating | newest

  let items = [...marketplaceItems];

  // Filter by category
  if (category && category !== 'all') {
    items = items.filter((item) => item.category === category);
  }

  // Filter by search query
  if (search) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        item.tags.some((tag) => tag.toLowerCase().includes(search)) ||
        item.author.toLowerCase().includes(search)
    );
  }

  // Filter by tier
  if (tier && tier !== 'all') {
    items = items.filter((item) => item.tier === tier);
  }

  // Sort
  switch (sort) {
    case 'rating':
      items.sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
      items.sort((a, b) => b.version.localeCompare(a.version));
      break;
    case 'popular':
    default:
      items.sort((a, b) => b.installCount - a.installCount);
      break;
  }

  return NextResponse.json({
    items,
    total: items.length,
    filters: {
      category: category ?? 'all',
      search,
      tier: tier ?? 'all',
      sort,
    },
  });
}
