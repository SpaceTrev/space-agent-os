// ============================================================
// Automation Marketplace — TypeScript Types
// ============================================================

export type MarketplaceCategory =
  | 'agent-template'
  | 'skill'
  | 'workflow'
  | 'playwright-script'
  | 'mcp-integration'
  | 'github-action'
  | 'script-utility'

export type PricingModel = 'free' | 'one-time' | 'subscription'

export interface MarketplacePricing {
  model: PricingModel
  price?: number // USD cents (e.g. 2900 = $29.00)
  interval?: 'month' | 'year'
}

export interface MarketplaceItem {
  id: string
  name: string
  description: string
  longDescription: string
  category: MarketplaceCategory
  tags: string[]
  author: string
  version: string
  rating: number // 0–5, one decimal place
  installCount: number
  pricing: MarketplacePricing
  icon: string // emoji
  screenshots?: string[]
  includedComponents?: string[]
  requirements?: string[]
}

export interface AgentTemplate extends MarketplaceItem {
  category: 'agent-template'
  persona: string
  includedSkills: string[]
  includedTools: string[]
  brainContext: string[]
  tier: 'primary' | 'secondary' | 'local'
}

// Category display metadata for UI
export interface CategoryMeta {
  id: MarketplaceCategory | 'all'
  label: string
  description: string
  color: string
}

export const CATEGORY_META: CategoryMeta[] = [
  {
    id: 'all',
    label: 'All',
    description: 'Browse everything',
    color: 'gray',
  },
  {
    id: 'agent-template',
    label: 'Agent Teams',
    description: 'Pre-configured AI agent personas',
    color: 'blue',
  },
  {
    id: 'skill',
    label: 'Skills',
    description: 'Reusable capability modules',
    color: 'purple',
  },
  {
    id: 'playwright-script',
    label: 'Automations',
    description: 'Browser and script automations',
    color: 'green',
  },
  {
    id: 'workflow',
    label: 'Workflows',
    description: 'n8n and automation workflows',
    color: 'orange',
  },
  {
    id: 'mcp-integration',
    label: 'Integrations',
    description: 'MCP server integrations',
    color: 'yellow',
  },
  {
    id: 'github-action',
    label: 'CI/CD',
    description: 'GitHub Actions and pipelines',
    color: 'red',
  },
]

// UI filter tabs (groups some categories together)
export interface FilterTab {
  id: string
  label: string
  categories: (MarketplaceCategory | 'all')[]
}

export const FILTER_TABS: FilterTab[] = [
  { id: 'all', label: 'All', categories: ['all'] },
  { id: 'fam', label: 'FAM Core', categories: ['all'] },
  { id: 'agents', label: 'Agent Teams', categories: ['agent-template'] },
  { id: 'skills', label: 'Skills', categories: ['skill'] },
  {
    id: 'automations',
    label: 'Automations',
    categories: ['workflow', 'playwright-script', 'github-action', 'script-utility'],
  },
  { id: 'integrations', label: 'Integrations', categories: ['mcp-integration'] },
]

// Pricing helpers
export function formatPrice(pricing: MarketplacePricing): string {
  if (pricing.model === 'free') return 'Free'
  if (!pricing.price) return 'Free'
  const dollars = (pricing.price / 100).toFixed(2)
  if (pricing.model === 'one-time') return `$${dollars}`
  if (pricing.model === 'subscription') {
    const interval = pricing.interval === 'year' ? '/yr' : '/mo'
    return `$${dollars}${interval}`
  }
  return 'Free'
}

export function categoryLabel(category: MarketplaceCategory): string {
  const meta = CATEGORY_META.find((m) => m.id === category)
  return meta?.label ?? category
}

// Convenience record aliases (used by workspace-scoped marketplace page)
export const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  'agent-template': 'Agent Teams',
  skill: 'Skills',
  workflow: 'Automations',
  'playwright-script': 'Scripts',
  'mcp-integration': 'Integrations',
  'github-action': 'GitHub Actions',
  'script-utility': 'Utilities',
}

export const CATEGORY_COLORS: Record<MarketplaceCategory, string> = {
  'agent-template': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  skill: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  workflow: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  'playwright-script': 'bg-green-500/20 text-green-400 border border-green-500/30',
  'mcp-integration': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  'github-action': 'bg-red-500/20 text-red-400 border border-red-500/30',
  'script-utility': 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
}
