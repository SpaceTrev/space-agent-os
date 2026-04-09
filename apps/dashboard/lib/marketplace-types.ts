// apps/dashboard/lib/marketplace-types.ts

export type MarketplaceCategory =
  | 'agent-template'
  | 'skill'
  | 'workflow'
  | 'playwright-script'
  | 'mcp-integration'
  | 'github-action'
  | 'script-utility';

export type MarketplaceTier = 'free' | 'starter' | 'pro' | 'enterprise';

export type MarketplacePricing = {
  type: 'free' | 'paid';
  amount?: number;
  currency?: string;
  interval?: 'one-time' | 'monthly' | 'yearly';
};

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: MarketplaceCategory;
  tags: string[];
  author: string;
  version: string;
  rating: number;
  installCount: number;
  pricing: MarketplacePricing;
  icon: string;
  tier: MarketplaceTier;
  createdAt?: string;
  updatedAt?: string;
}

export type CategoryFilter =
  | 'all'
  | 'agent-template'
  | 'skill'
  | 'workflow'
  | 'playwright-script'
  | 'mcp-integration'
  | 'github-action';

export const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  'agent-template': 'Agent Teams',
  skill: 'Skills',
  workflow: 'Automations',
  'playwright-script': 'Scripts',
  'mcp-integration': 'Integrations',
  'github-action': 'GitHub Actions',
  'script-utility': 'Utilities',
};

export const CATEGORY_COLORS: Record<MarketplaceCategory, string> = {
  'agent-template': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  skill: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  workflow: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'playwright-script': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'mcp-integration': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'github-action': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'script-utility': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};
