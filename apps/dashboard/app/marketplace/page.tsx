// apps/dashboard/app/marketplace/page.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Star,
  Download,
  X,
  ArrowLeft,
  Sparkles,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { marketplaceItems } from '@/lib/marketplace-data';
import {
  MarketplaceItem,
  MarketplaceCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from '@/lib/marketplace-types';

// ── Filter tab config ──────────────────────────────────────
type TabKey = 'all' | 'agent-template' | 'skill' | 'workflow' | 'playwright-script' | 'mcp-integration' | 'github-action';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'agent-template', label: 'Agent Teams' },
  { key: 'skill', label: 'Skills' },
  { key: 'workflow', label: 'Automations' },
  { key: 'playwright-script', label: 'Scripts' },
  { key: 'mcp-integration', label: 'Integrations' },
  { key: 'github-action', label: 'Actions' },
];

// ── Stars component ────────────────────────────────────────
function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-slate-700 text-slate-700'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Price badge ────────────────────────────────────────────
function PriceBadge({ pricing }: { pricing: MarketplaceItem['pricing'] }) {
  if (pricing.type === 'free') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/25">
        Free
      </span>
    );
  }
  return (
    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/25">
      ${pricing.amount}
      {pricing.interval === 'monthly' && '/mo'}
      {pricing.interval === 'yearly' && '/yr'}
    </span>
  );
}

// ── Install count formatter ────────────────────────────────
function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

// ── Marketplace card ───────────────────────────────────────
function MarketplaceCard({
  item,
  onClick,
}: {
  item: MarketplaceItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-left transition-all duration-200 hover:border-indigo-500/40 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-indigo-500/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-2xl">
          {item.icon}
        </div>
        <PriceBadge pricing={item.pricing} />
      </div>

      {/* Name */}
      <h3 className="mt-3 text-sm font-semibold text-slate-100 group-hover:text-white">
        {item.name}
      </h3>

      {/* Category badge */}
      <span
        className={`mt-2 inline-flex w-fit rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
          CATEGORY_COLORS[item.category]
        }`}
      >
        {CATEGORY_LABELS[item.category]}
      </span>

      {/* Description */}
      <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
        {item.description}
      </p>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-4">
        <RatingStars rating={item.rating} />
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Download className="h-3 w-3" />
          {formatInstalls(item.installCount)}
        </div>
      </div>

      {/* Author */}
      <p className="mt-2 text-[11px] text-slate-600">by {item.author}</p>
    </button>
  );
}

// ── Detail panel ───────────────────────────────────────────
function DetailPanel({
  item,
  onClose,
}: {
  item: MarketplaceItem;
  onClose: () => void;
}) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = () => {
    setInstalling(true);
    setTimeout(() => setInstalling(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-8">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0C0C0F] shadow-2xl shadow-indigo-500/5">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Back link */}
          <button
            onClick={onClose}
            className="mb-6 flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Marketplace
          </button>

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-3xl">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-white">{item.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    CATEGORY_COLORS[item.category]
                  }`}
                >
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span className="text-xs text-slate-500">v{item.version}</span>
                <span className="text-xs text-slate-500">by {item.author}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap items-center gap-6 rounded-lg border border-slate-800/60 bg-slate-900/40 px-5 py-3">
            <div className="flex items-center gap-2">
              <RatingStars rating={item.rating} />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Download className="h-4 w-4" />
              {item.installCount.toLocaleString()} installs
            </div>
            <PriceBadge pricing={item.pricing} />
          </div>

          {/* Description */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-200">Description</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {item.longDescription || item.description}
            </p>
          </div>

          {/* Tags */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-200">Tags</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-slate-800/80 px-2.5 py-1 text-xs text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Tier */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-200">Required Tier</h3>
            <p className="mt-1 text-sm capitalize text-slate-400">{item.tier}</p>
          </div>

          {/* Install button */}
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {installing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Installing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Install
                </>
              )}
            </button>
            {item.pricing.type === 'paid' && (
              <span className="text-xs text-slate-500">
                ${item.pricing.amount}
                {item.pricing.interval === 'monthly' && '/month'}
                {item.pricing.interval === 'yearly' && '/year'}
                {item.pricing.interval === 'one-time' && ' one-time'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sort dropdown ──────────────────────────────────────────
type SortKey = 'popular' | 'rating' | 'newest';

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const labels: Record<SortKey, string> = {
    popular: 'Most Popular',
    rating: 'Highest Rated',
    newest: 'Newest',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-700"
      >
        <Filter className="h-3.5 w-3.5 text-slate-500" />
        {labels[value]}
        <ChevronDown className="h-3 w-3 text-slate-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-slate-800 bg-[#0C0C0F] py-1 shadow-xl">
            {(Object.keys(labels) as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs transition hover:bg-slate-800 ${
                  value === key ? 'text-indigo-400' : 'text-slate-400'
                }`}
              >
                {labels[key]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('popular');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);

  const filteredItems = useMemo(() => {
    let items = [...marketplaceItems];

    // Category filter
    if (activeTab !== 'all') {
      items = items.filter((item) => item.category === activeTab);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.includes(q)) ||
          item.author.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
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

    return items;
  }, [activeTab, searchQuery, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Marketplace
        </h1>
        <p className="text-sm text-slate-400">
          Extend your agents with templates, skills, integrations, and automations.
        </p>
      </div>

      {/* ── Search + Sort bar ──────────────────────────── */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search marketplace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* ── Category tabs ──────────────────────────────── */}
      <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Results count ──────────────────────────────── */}
      <p className="mt-5 text-xs text-slate-500">
        {filteredItems.length} item{filteredItems.length !== 1 && 's'} found
      </p>

      {/* ── Grid ───────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/60 text-3xl">
            🔍
          </div>
          <p className="mt-4 text-sm font-medium text-slate-300">No items found</p>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <MarketplaceCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {/* ── Detail modal ───────────────────────────────── */}
      {selectedItem && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
