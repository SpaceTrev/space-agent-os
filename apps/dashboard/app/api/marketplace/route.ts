// ============================================================
// GET  /api/marketplace  — list marketplace items
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import type { MarketplaceItem, MarketplaceCategory } from '@/lib/marketplace-types'

const now = new Date().toISOString()

const SEED_ITEMS: MarketplaceItem[] = [
  {
    id: 'mkt-001',
    name: 'Research Agent',
    description: 'Finds, synthesizes, and summarizes information from the web with source citations.',
    longDescription: 'A specialist agent pre-configured for deep research tasks. Uses web search, PDF reading, and structured note-taking to produce detailed research briefs.',
    category: 'agent-template',
    author: 'Space OS Team',
    version: '1.2.0',
    rating: 4.8,
    installCount: 4821,
    pricing: { type: 'free' },
    icon: 'search',
    tier: 'free',
    tags: ['research', 'web-search', 'summarization'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-002',
    name: 'Code Review Team',
    description: 'Reviews pull requests for bugs, security issues, and code quality violations.',
    longDescription: 'Automated code review agent that integrates with GitHub PRs. Catches bugs, enforces style guides, and suggests refactors before human review.',
    category: 'agent-template',
    author: 'Space OS Team',
    version: '1.1.0',
    rating: 4.7,
    installCount: 3240,
    pricing: { type: 'free' },
    icon: 'code',
    tier: 'free',
    tags: ['code-review', 'github', 'security'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-003',
    name: 'Content Writer Team',
    description: 'Produces SEO-optimized blog posts, landing pages, and marketing copy at scale.',
    longDescription: 'A high-quality content generation team with planner, writer, and editor agents. Handles briefs, outlines, drafts, and revisions in one pipeline.',
    category: 'agent-template',
    author: 'ContentForge',
    version: '2.0.1',
    rating: 4.6,
    installCount: 2105,
    pricing: { type: 'paid', amount: 9, currency: 'USD', interval: 'monthly' },
    icon: 'edit',
    tier: 'starter',
    tags: ['content', 'seo', 'marketing', 'copywriting'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-004',
    name: 'Data Analyst Agent',
    description: 'Queries databases, generates charts, and writes analytical reports from raw data.',
    longDescription: 'Connect to Postgres, BigQuery, or CSV files and get instant analytical reports with charts and actionable insights.',
    category: 'agent-template',
    author: 'DataStack Labs',
    version: '1.4.2',
    rating: 4.9,
    installCount: 1890,
    pricing: { type: 'paid', amount: 12, currency: 'USD', interval: 'monthly' },
    icon: 'bar-chart',
    tier: 'pro',
    tags: ['data', 'analytics', 'sql', 'charts'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-005',
    name: 'QA Tester Agent',
    description: 'Writes and runs end-to-end tests using Playwright, flags regressions automatically.',
    longDescription: 'Automatically generates E2E test suites from your app URL or spec files. Runs Playwright tests in CI and surfaces regressions with screenshots.',
    category: 'playwright-script',
    author: 'Space OS Team',
    version: '1.0.3',
    rating: 4.5,
    installCount: 1432,
    pricing: { type: 'free' },
    icon: 'check-circle',
    tier: 'free',
    tags: ['testing', 'playwright', 'qa', 'automation'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-006',
    name: 'Web Search Skill',
    description: 'Real-time web search powered by Perplexity — returns structured results with sources.',
    longDescription: 'Give any agent access to live web search. Returns ranked, deduplicated results with URL, title, snippet, and publish date.',
    category: 'skill',
    author: 'Space OS Team',
    version: '2.1.0',
    rating: 4.9,
    installCount: 8902,
    pricing: { type: 'free' },
    icon: 'globe',
    tier: 'free',
    tags: ['search', 'web', 'perplexity'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-007',
    name: 'GitHub MCP Integration',
    description: 'Read repos, open issues, create PRs, and review diffs directly from agent tasks.',
    longDescription: 'Full GitHub API wrapper as an MCP integration. Supports reading files, creating commits, opening PRs, and managing issues with workspace-level auth.',
    category: 'mcp-integration',
    author: 'Space OS Team',
    version: '1.3.0',
    rating: 4.8,
    installCount: 6215,
    pricing: { type: 'free' },
    icon: 'git-branch',
    tier: 'free',
    tags: ['github', 'git', 'code', 'devops'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-008',
    name: 'Slack Notifier Skill',
    description: 'Posts task updates, alerts, and agent outputs to any Slack channel or DM.',
    longDescription: 'Lightweight Slack integration tool. Post messages, create threads, upload files, and react to messages from any agent in your workspace.',
    category: 'skill',
    author: 'Space OS Team',
    version: '1.0.1',
    rating: 4.7,
    installCount: 5671,
    pricing: { type: 'free' },
    icon: 'message-square',
    tier: 'free',
    tags: ['slack', 'notifications', 'alerts'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-009',
    name: 'PDF Reader Skill',
    description: 'Extracts text, tables, and metadata from PDFs for agent ingestion.',
    longDescription: 'Advanced PDF processing skill that handles scanned documents via OCR, extracts structured tables, and chunks content for RAG pipelines.',
    category: 'skill',
    author: 'DocParse AI',
    version: '1.1.0',
    rating: 4.6,
    installCount: 3240,
    pricing: { type: 'paid', amount: 5, currency: 'USD', interval: 'monthly' },
    icon: 'file-text',
    tier: 'starter',
    tags: ['pdf', 'ocr', 'documents', 'rag'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-010',
    name: 'Python Executor Skill',
    description: 'Runs Python code in a sandboxed environment and returns structured output.',
    longDescription: 'Safe Python execution skill with access to NumPy, Pandas, Matplotlib, and SciPy. Returns stdout, stderr, figures, and variables as structured JSON.',
    category: 'skill',
    author: 'Space OS Team',
    version: '2.0.0',
    rating: 4.9,
    installCount: 7430,
    pricing: { type: 'free' },
    icon: 'terminal',
    tier: 'free',
    tags: ['python', 'code-execution', 'data-science'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-011',
    name: 'SQL Query Skill',
    description: 'Generates, validates, and executes SQL against connected databases.',
    longDescription: 'End-to-end SQL skill. Translates natural language to SQL, validates against the schema, runs it safely, and formats results as markdown tables.',
    category: 'skill',
    author: 'Space OS Team',
    version: '1.2.1',
    rating: 4.8,
    installCount: 4892,
    pricing: { type: 'free' },
    icon: 'database',
    tier: 'free',
    tags: ['sql', 'database', 'data'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-012',
    name: 'Vision Analysis Skill',
    description: 'Describes, classifies, and extracts data from images using multimodal models.',
    longDescription: 'Adds vision capabilities to any agent. Handles product photos, charts, UI screenshots, and documents. Returns structured JSON with labels and extracted text.',
    category: 'skill',
    author: 'VisionKit',
    version: '1.0.0',
    rating: 4.7,
    installCount: 2108,
    pricing: { type: 'paid', amount: 7, currency: 'USD', interval: 'monthly' },
    icon: 'eye',
    tier: 'pro',
    tags: ['vision', 'images', 'multimodal', 'ocr'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-013',
    name: 'Sprint Planner Workflow',
    description: 'Pre-built sprint structure with backlog grooming, task breakdown, and review stages.',
    longDescription: 'A complete sprint workflow with predefined agent roles, task templates, and review checkpoints. Import into any workspace and start your first sprint in minutes.',
    category: 'workflow',
    author: 'Space OS Team',
    version: '1.1.0',
    rating: 4.6,
    installCount: 3102,
    pricing: { type: 'free' },
    icon: 'git-branch',
    tier: 'free',
    tags: ['sprint', 'planning', 'agile', 'workflow'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-014',
    name: 'Bug Fix Workflow',
    description: 'Structured sprint for triage, reproduction, fix, and regression testing of bugs.',
    longDescription: 'A focused workflow for bug-fixing cycles. Includes triage agent, reproduction task, patch task, QA agent, and regression test gate.',
    category: 'workflow',
    author: 'Space OS Team',
    version: '1.0.2',
    rating: 4.5,
    installCount: 1987,
    pricing: { type: 'free' },
    icon: 'bug',
    tier: 'free',
    tags: ['bugs', 'sprint', 'qa', 'workflow'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mkt-015',
    name: 'Zapier Bridge',
    description: 'Trigger 6,000+ Zapier automations from agent task completions.',
    longDescription: 'Bidirectional Zapier MCP integration. Trigger Zaps when tasks complete, and dispatch Space OS tasks from Zapier triggers. No code required.',
    category: 'mcp-integration',
    author: 'Automate.io',
    version: '0.9.0',
    rating: 4.3,
    installCount: 892,
    pricing: { type: 'paid', amount: 15, currency: 'USD', interval: 'monthly' },
    icon: 'zap',
    tier: 'starter',
    tags: ['zapier', 'automation', 'no-code', 'integrations'],
    createdAt: now,
    updatedAt: now,
  },
]

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') as MarketplaceCategory | 'all' | null
  const search = req.nextUrl.searchParams.get('search')?.toLowerCase()
  const tier = req.nextUrl.searchParams.get('tier')
  const sort = req.nextUrl.searchParams.get('sort') ?? 'popular'

  let items = [...SEED_ITEMS]

  if (category && category !== 'all') {
    items = items.filter((i) => i.category === category)
  }

  if (search) {
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(search) ||
        i.description.toLowerCase().includes(search) ||
        i.tags.some((t) => t.toLowerCase().includes(search)) ||
        i.author.toLowerCase().includes(search)
    )
  }

  if (tier && tier !== 'all') {
    items = items.filter((i) => i.tier === tier)
  }

  switch (sort) {
    case 'rating':
      items.sort((a, b) => b.rating - a.rating)
      break
    case 'newest':
      items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      break
    case 'popular':
    default:
      items.sort((a, b) => b.installCount - a.installCount)
  }

  return NextResponse.json({ items, total: items.length, filters: { category: category ?? 'all', search: search ?? '', tier: tier ?? 'all', sort } })
}
