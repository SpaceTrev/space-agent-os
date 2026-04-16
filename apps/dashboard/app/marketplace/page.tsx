'use client'

import { useState, useMemo, useCallback } from 'react'
import { clsx } from 'clsx'
import { Search, Star, Download, X, Tag, Package } from 'lucide-react'
import type { MarketplaceItem, AgentTemplate } from '@/lib/marketplace-types'
import { FILTER_TABS, formatPrice, categoryLabel } from '@/lib/marketplace-types'
import { MARKETPLACE_ITEMS, filterByCategory, searchItems } from '@/lib/marketplace-data'

// ──────────────────────────────────────────────────────────────
// Category badge colors — tonal, no ring-*
// ──────────────────────────────────────────────────────────────
const categoryColors: Record<string, string> = {
  'agent-template': 'bg-blue-500/15 text-blue-400',
  skill: 'bg-purple-500/15 text-purple-400',
  workflow: 'bg-orange-500/15 text-orange-400',
  'playwright-script': 'bg-green-500/15 text-green-400',
  'mcp-integration': 'bg-yellow-500/15 text-yellow-400',
  'github-action': 'bg-red-500/15 text-red-400',
  'script-utility': 'bg-teal-500/15 text-teal-400',
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const partial = rating - full
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={clsx(
            'w-3 h-3',
            i <= full
              ? 'text-yellow-400 fill-yellow-400'
              : i === full + 1 && partial >= 0.5
              ? 'text-yellow-400 fill-yellow-400/50'
              : 'text-[var(--on-surface-variant)] opacity-40 fill-transparent'
          )}
        />
      ))}
      <span className="ml-1 text-xs text-[var(--on-surface-variant)] opacity-70">{rating.toFixed(1)}</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Marketplace Card
// ──────────────────────────────────────────────────────────────
function MarketplaceCard({
  item,
  onClick,
}: {
  item: MarketplaceItem | AgentTemplate
  onClick: () => void
}) {
  const priceText = formatPrice(item.pricing)
  const catColor = categoryColors[item.category] ?? 'bg-gray-500/15 text-gray-400'

  return (
    <button
      onClick={onClick}
      className="group text-left w-full bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] rounded-xl p-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
    >
      {/* Icon + category */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-lg bg-[var(--surface-container-high)] flex items-center justify-center text-2xl flex-shrink-0">
          {item.icon}
        </div>
        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-md', catColor)}>
          {categoryLabel(item.category)}
        </span>
      </div>

      {/* Name & description */}
      <h3 className="text-sm font-semibold text-[var(--on-surface)] group-hover:text-[var(--primary)] transition-colors mb-1.5 leading-snug">
        {item.name}
      </h3>
      <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed line-clamp-2 mb-4">
        {item.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <StarRating rating={item.rating} />
          <div className="flex items-center gap-1 text-xs text-[var(--on-surface-variant)]">
            <Download className="w-3 h-3" />
            {formatCount(item.installCount)} installs
          </div>
        </div>
        <div
          className={clsx(
            'text-sm font-semibold',
            item.pricing.model === 'free' ? 'text-[var(--primary)]' : 'text-[var(--on-surface)]'
          )}
        >
          {priceText}
        </div>
      </div>
    </button>
  )
}

// ──────────────────────────────────────────────────────────────
// Detail Modal — Frosted Obsidian
// ──────────────────────────────────────────────────────────────
function DetailModal({
  item,
  onClose,
}: {
  item: MarketplaceItem | AgentTemplate | null
  onClose: () => void
}) {
  if (!item) return null

  const priceText = formatPrice(item.pricing)
  const catColor = categoryColors[item.category] ?? 'bg-gray-500/15 text-gray-400'
  const isAgentTemplate = item.category === 'agent-template'
  const agentItem = isAgentTemplate ? (item as AgentTemplate) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--surface)]/70 backdrop-blur-sm" role="dialog" aria-modal>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--surface)]/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — Frosted Obsidian */}
      <div className="relative w-full max-w-2xl bg-[var(--surface-container-high)] [backdrop-filter:blur(12px)] rounded-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-[var(--surface-container-highest)] flex items-center justify-center text-3xl flex-shrink-0">
              {item.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-[var(--on-surface)]">{item.name}</h2>
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-md', catColor)}>
                  {categoryLabel(item.category)}
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)] opacity-70">
                by {item.author} · v{item.version}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Stats row — no divider, use gap */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <StarRating rating={item.rating} />
              <span className="text-xs text-[var(--on-surface-variant)] opacity-70">{formatCount(item.installCount)} installs</span>
            </div>
            <div className="w-px h-8 bg-[var(--outline-variant)]" />
            <div>
              <span
                className={clsx(
                  'text-lg font-bold',
                  item.pricing.model === 'free' ? 'text-[var(--primary)]' : 'text-[var(--on-surface)]'
                )}
              >
                {priceText}
              </span>
              {item.pricing.model === 'subscription' && (
                <span className="text-xs text-[var(--on-surface-variant)] opacity-70 ml-1">per {item.pricing.interval}</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider mb-2">
              Description
            </h3>
            <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">{item.longDescription}</p>
          </div>

          {/* Agent template specifics */}
          {agentItem && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider mb-2">
                Agent Persona
              </h3>
              <div className="bg-[var(--surface-container-low)] rounded-lg p-3">
                <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed italic">
                  &ldquo;{agentItem.persona}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Included components */}
          {item.includedComponents && item.includedComponents.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider mb-2">
                What&rsquo;s Included
              </h3>
              <ul className="space-y-1.5">
                {item.includedComponents.map((comp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--on-surface-variant)]">
                    <Package className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                    {comp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Requirements */}
          {item.requirements && item.requirements.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider mb-2">
                Requirements
              </h3>
              <ul className="space-y-1.5">
                {item.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--on-surface-variant)] opacity-70">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--on-surface-variant)] opacity-40 flex-shrink-0 mt-1.5" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs text-[var(--on-surface-variant)] bg-[var(--surface-container-low)] px-2 py-0.5 rounded-md"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — no border-t, use pt spacing */}
        <div className="px-6 pt-4 pb-5 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
          >
            Cancel
          </button>
          <a
            href="/signup"
            className="flex items-center gap-2 px-5 py-2 bg-[var(--primary)] text-[var(--surface)] text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Install — {priceText}
          </a>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | AgentTemplate | null>(null)

  const filteredItems = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.id === activeTab) ?? FILTER_TABS[0]
    const byCat = filterByCategory(MARKETPLACE_ITEMS, tab.categories)
    return searchItems(byCat, query)
  }, [activeTab, query])

  const handleCardClick = useCallback((item: MarketplaceItem | AgentTemplate) => {
    setSelectedItem(item)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedItem(null)
  }, [])

  return (
    <>
      {/* Hero — no border-b, tonal surface */}
      <section className="bg-[var(--surface-container-low)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--primary-container)] text-xs text-[var(--primary)] font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            {MARKETPLACE_ITEMS.length} automations available
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--on-surface)] mb-4">
            Automation Marketplace
          </h1>
          <p className="text-[var(--on-surface-variant)] max-w-xl mx-auto text-base leading-relaxed mb-8">
            Browse and install pre-built agent templates, skills, workflows, and integrations.
            One click to add to your workspace.
          </p>

          {/* Search — no explicit border */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--on-surface-variant)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search agents, skills, integrations..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-container)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]/40 outline-none transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Category tabs — rounded-lg not rounded-full */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-[var(--surface-container-highest)] text-[var(--primary)]'
                  : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-xs text-[var(--on-surface-variant)] opacity-70 mb-5">
          {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
          {query && ` for "${query}"`}
        </p>

        {/* Grid */}
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                onClick={() => handleCardClick(item)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-container-high)] flex items-center justify-center text-2xl mb-4">
              🔍
            </div>
            <h3 className="text-sm font-semibold text-[var(--on-surface)] mb-1">No results found</h3>
            <p className="text-xs text-[var(--on-surface-variant)] opacity-70">Try a different search term or category</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <DetailModal item={selectedItem} onClose={handleClose} />
    </>
  )
}
