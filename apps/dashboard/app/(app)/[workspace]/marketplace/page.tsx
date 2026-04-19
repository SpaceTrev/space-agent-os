'use client'

import { useEffect, useState, use } from 'react'
import { clsx } from 'clsx'
import {
  Search,
  Star,
  Download,
  Bot,
  Zap,
  GitBranch,
  Puzzle,
  FileCode,
  Plug,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'
import {
  type MarketplaceItem,
  type MarketplaceCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from '@/lib/marketplace-types'

type CategoryFilter = 'all' | MarketplaceCategory

const CATEGORY_NAV: { value: CategoryFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Sparkles },
  { value: 'agent-template', label: CATEGORY_LABELS['agent-template'], icon: Bot },
  { value: 'skill', label: CATEGORY_LABELS['skill'], icon: Zap },
  { value: 'workflow', label: CATEGORY_LABELS['workflow'], icon: GitBranch },
  { value: 'playwright-script', label: CATEGORY_LABELS['playwright-script'], icon: FileCode },
  { value: 'mcp-integration', label: CATEGORY_LABELS['mcp-integration'], icon: Plug },
  { value: 'github-action', label: CATEGORY_LABELS['github-action'], icon: Puzzle },
]

const ICON_GRADIENTS: Record<string, string> = {
  'agent-template': 'from-indigo-500 to-indigo-700',
  skill: 'from-emerald-500 to-emerald-700',
  workflow: 'from-amber-500 to-amber-700',
  'playwright-script': 'from-purple-500 to-purple-700',
  'mcp-integration': 'from-cyan-500 to-cyan-700',
  'github-action': 'from-rose-500 to-rose-700',
  'script-utility': 'from-slate-500 to-slate-700',
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'agent-template': Bot,
  skill: Zap,
  workflow: GitBranch,
  'playwright-script': FileCode,
  'mcp-integration': Plug,
  'github-action': Puzzle,
  'script-utility': Puzzle,
}

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function ItemCard({ item }: { item: MarketplaceItem }) {
  const gradient = ICON_GRADIENTS[item.category] ?? 'from-gray-500 to-gray-700'
  const CategoryIcon = CATEGORY_ICONS[item.category] ?? Bot
  const isFree = item.pricing.model === 'free'
  const categoryStyle = CATEGORY_COLORS[item.category]

  return (
    <div className="group flex flex-col bg-surface-base border border-outline-variant rounded-xl p-5 hover:border-outline-variant hover:bg-surface-high/60 transition-all duration-150">
      {/* Icon + tier badge */}
      <div className="flex items-start justify-between mb-4">
        <div className={clsx('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', gradient)}>
          <CategoryIcon className="w-6 h-6 text-on-surface" />
        </div>
        {!isFree && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-brand-500/15 text-brand-400 text-xs font-medium capitalize">
            <Sparkles className="w-3 h-3" />
            Pro
          </span>
        )}
      </div>

      {/* Name + author */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-on-surface leading-snug">{item.name}</h3>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-xs text-on-surface-variant">{item.author}</p>
          {item.author === 'Space OS Team' && (
            <BadgeCheck className="w-3 h-3 text-brand-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-on-surface-variant leading-relaxed flex-1 mb-4 line-clamp-2">
        {item.description}
      </p>

      {/* Category + tags */}
      <div className="flex flex-wrap gap-1 mb-4">
        <span className={clsx('px-1.5 py-0.5 rounded border text-[10px] font-medium', categoryStyle)}>
          {CATEGORY_LABELS[item.category]}
        </span>
        {item.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded bg-surface-high text-on-surface-variant text-[10px] font-medium"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Stats + CTA */}
      <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            {item.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            {formatInstalls(item.installCount)}
          </span>
          <span className="text-on-surface-variant">v{item.version}</span>
        </div>
        <button className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          isFree
            ? 'bg-brand-600 hover:bg-brand-500 text-white'
            : 'bg-surface-high hover:bg-surface-highest text-on-surface border border-outline-variant'
        )}>
          {isFree
            ? 'Install'
            : item.pricing.price
            ? `$${(item.pricing.price / 100).toFixed(0)}/${item.pricing.interval === 'year' ? 'yr' : 'mo'}`
            : 'Paid'}
        </button>
      </div>
    </div>
  )
}

export default function MarketplacePage({ params }: { params: Promise<{ workspace: string }> }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { workspace } = use(params)
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'popular' | 'rating' | 'newest'>('popular')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (category !== 'all') qs.set('category', category)
    if (debouncedSearch) qs.set('search', debouncedSearch)
    qs.set('sort', sort)

    fetch(`/api/marketplace?${qs}`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((data) => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category, debouncedSearch, sort])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface">Marketplace</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Browse and install agents, tools, skills, and workflows for your workspace.
        </p>
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          <input
            type="text"
            placeholder="Search marketplace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-base border border-outline-variant rounded-lg text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-outline-variant transition-colors"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="px-3 py-2 bg-surface-base border border-outline-variant rounded-lg text-sm text-on-surface-variant focus:outline-none focus:border-outline-variant transition-colors"
        >
          <option value="popular">Most popular</option>
          <option value="rating">Highest rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORY_NAV.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setCategory(value)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              category === value
                ? 'bg-surface-highest text-on-surface'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Item count */}
      {!loading && (
        <p className="text-xs text-on-surface-variant mb-4">
          {items.length} {items.length === 1 ? 'result' : 'results'}
          {category !== 'all' && ` in ${CATEGORY_LABELS[category as MarketplaceCategory]}`}
          {debouncedSearch && ` for "${debouncedSearch}"`}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-high border border-outline-variant flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-sm font-medium text-on-surface">No results found</p>
          <p className="text-xs text-on-surface-variant mt-1">Try a different search term or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
