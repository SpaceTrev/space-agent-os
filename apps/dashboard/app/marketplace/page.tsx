'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import {
  Bot,
  Zap,
  FileCode2,
  Globe,
  GitBranch,
  Play,
  Puzzle,
  Search,
  Star,
  Download,
  X,
  ExternalLink,
  ChevronLeft,
  Tag,
  User,
  Calendar,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type MarketplaceCategory =
  | 'agent-template'
  | 'skill'
  | 'workflow'
  | 'playwright-script'
  | 'mcp-integration'
  | 'github-action'
  | 'script-utility'

interface MarketplaceItem {
  id: string
  name: string
  category: MarketplaceCategory
  description: string
  longDescription: string
  author: string
  version: string
  rating: number
  ratingCount: number
  installCount: number
  tags: string[]
  publishedAt: string
  featured?: boolean
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const ITEMS: MarketplaceItem[] = [
  // Agent Templates (4)
  {
    id: 'agent-research-assistant',
    name: 'Research Assistant',
    category: 'agent-template',
    description: 'Web research agent that finds, synthesizes, and summarizes information from multiple sources.',
    longDescription:
      'A fully-configured agent template for deep research tasks. Integrates Perplexity for web search, automatic source deduplication, and structured markdown output. Supports iterative refinement — ask follow-up questions to drill deeper into any topic. Ideal for competitive research, market analysis, and technical deep-dives.',
    author: 'space-agent-os',
    version: '1.3.0',
    rating: 4.8,
    ratingCount: 142,
    installCount: 2341,
    tags: ['research', 'web-search', 'summarization', 'perplexity'],
    publishedAt: '2026-01-15',
    featured: true,
  },
  {
    id: 'agent-code-reviewer',
    name: 'Code Reviewer',
    category: 'agent-template',
    description: 'Automated PR review agent that checks for bugs, security issues, and style violations.',
    longDescription:
      'Drop this agent into your workspace and point it at your GitHub repo. It reviews pull requests for logic errors, security vulnerabilities (OWASP Top 10), test coverage gaps, and style inconsistencies. Outputs structured comments you can paste directly into GitHub or Linear. Works with TypeScript, Python, Go, and Rust.',
    author: 'space-agent-os',
    version: '2.1.0',
    rating: 4.9,
    ratingCount: 89,
    installCount: 1872,
    tags: ['code-review', 'github', 'security', 'quality'],
    publishedAt: '2026-02-03',
    featured: true,
  },
  {
    id: 'agent-email-triage',
    name: 'Email Triage',
    category: 'agent-template',
    description: 'Inbox zero agent that categorizes, prioritizes, and drafts replies to your emails.',
    longDescription:
      'Connects to Gmail via OAuth and runs on a schedule. Reads unread emails, categorizes them (urgent, follow-up, FYI, spam), and drafts responses for high-priority items. Generates a daily digest of what it handled. Configurable with your personal context so replies match your voice.',
    author: 'community',
    version: '1.0.2',
    rating: 4.5,
    ratingCount: 61,
    installCount: 934,
    tags: ['email', 'gmail', 'productivity', 'scheduling'],
    publishedAt: '2026-02-28',
  },
  {
    id: 'agent-data-analyst',
    name: 'Data Analyst',
    category: 'agent-template',
    description: 'Analyze CSV/JSON datasets and generate insights, charts, and executive summaries.',
    longDescription:
      'Upload a dataset and this agent generates descriptive statistics, identifies trends, flags anomalies, and produces a narrative summary with recommended actions. Outputs a markdown report with embedded chart definitions (Recharts-compatible). Supports datasets up to 100k rows via chunked processing.',
    author: 'community',
    version: '1.1.0',
    rating: 4.6,
    ratingCount: 48,
    installCount: 721,
    tags: ['data', 'analytics', 'csv', 'charts', 'reporting'],
    publishedAt: '2026-03-10',
  },

  // Skills (3)
  {
    id: 'skill-web-search',
    name: 'Web Search',
    category: 'skill',
    description: 'Real-time web search via Perplexity and Brave Search APIs with source citation.',
    longDescription:
      'Gives any agent the ability to search the web in real-time. Supports both Perplexity Sonar (AI-summarized results) and Brave Search (raw results with full citation). Configurable per-query result count, freshness filters, and domain blocklists. Returns structured JSON so agents can reason over the results.',
    author: 'space-agent-os',
    version: '3.0.1',
    rating: 4.9,
    ratingCount: 203,
    installCount: 4102,
    tags: ['search', 'perplexity', 'brave', 'web', 'real-time'],
    publishedAt: '2025-11-20',
    featured: true,
  },
  {
    id: 'skill-git-operations',
    name: 'Git Operations',
    category: 'skill',
    description: 'Clone repos, create branches, commit changes, open PRs — all from agent tasks.',
    longDescription:
      'A comprehensive Git skill that enables agents to interact with GitHub and GitLab repositories. Supports clone, branch, commit, push, PR creation, and review comment posting. Handles authentication via stored tokens. Includes sandboxed execution so file operations are isolated to a temp workspace per task.',
    author: 'space-agent-os',
    version: '2.4.0',
    rating: 4.7,
    ratingCount: 117,
    installCount: 2088,
    tags: ['git', 'github', 'gitlab', 'ci', 'automation'],
    publishedAt: '2025-12-05',
  },
  {
    id: 'skill-slack-notifier',
    name: 'Slack Notifier',
    category: 'skill',
    description: 'Send rich Slack messages with blocks, attachments, and thread replies from agents.',
    longDescription:
      'Equips agents with the ability to send Slack messages using Block Kit formatting. Supports sending to channels, DMs, and threads. Includes templates for common patterns: task completion notices, error alerts, daily digests, and approval requests. Configures with your Slack Bot OAuth token stored encrypted in your workspace.',
    author: 'community',
    version: '1.2.0',
    rating: 4.4,
    ratingCount: 79,
    installCount: 1543,
    tags: ['slack', 'notifications', 'messaging', 'block-kit'],
    publishedAt: '2026-01-08',
  },

  // Scripts / script-utility (3)
  {
    id: 'script-railway-deploy',
    name: 'Deploy to Railway',
    category: 'script-utility',
    description: 'One-click Railway deployment script with env var syncing and health check polling.',
    longDescription:
      'Automates Railway service deployments from your agent tasks. Syncs environment variables from your .env file, triggers a deploy, polls for build completion, runs a configurable health check URL, and reports success or rollback. Supports mono-repo service selection and multi-service deployments.',
    author: 'space-agent-os',
    version: '1.0.5',
    rating: 4.6,
    ratingCount: 53,
    installCount: 876,
    tags: ['railway', 'deployment', 'devops', 'ci-cd'],
    publishedAt: '2026-02-12',
  },
  {
    id: 'script-db-backup',
    name: 'Database Backup',
    category: 'script-utility',
    description: 'Automated Postgres dump with compression, S3 upload, and retention management.',
    longDescription:
      'Runs pg_dump on your Supabase or self-hosted Postgres instance, compresses with gzip, uploads to an S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2), and prunes backups older than your retention window. Sends a Slack notification on completion or failure. Schedule it via cron or trigger from an agent.',
    author: 'community',
    version: '2.0.0',
    rating: 4.8,
    ratingCount: 37,
    installCount: 612,
    tags: ['postgres', 'backup', 's3', 'database', 'scheduled'],
    publishedAt: '2026-01-22',
  },
  {
    id: 'script-log-aggregator',
    name: 'Log Aggregator',
    category: 'script-utility',
    description: 'Collect, filter, and summarize agent execution logs into a readable daily report.',
    longDescription:
      'Scrapes audit.jsonl and task logs from all your agents, deduplicates noise, groups errors by root cause, and produces a concise daily operations report. Highlights anomalies, cost spikes, and recurring failures. Outputs Markdown suitable for Slack, email, or Notion. Configurable severity thresholds.',
    author: 'space-agent-os',
    version: '1.1.0',
    rating: 4.3,
    ratingCount: 28,
    installCount: 441,
    tags: ['logs', 'monitoring', 'reporting', 'devops', 'audit'],
    publishedAt: '2026-03-01',
  },

  // MCP Integrations (2)
  {
    id: 'mcp-linear',
    name: 'Linear MCP',
    category: 'mcp-integration',
    description: 'Full Linear integration — read issues, create tasks, update status, and triage cycles.',
    longDescription:
      'Connects your agents to Linear via the official MCP protocol. Exposes tools for listing issues, creating new tickets, updating status and priority, adding comments, and assigning to team members. Agents can autonomously triage inbound issues, move tasks through your workflow, and generate weekly cycle summaries.',
    author: 'space-agent-os',
    version: '1.5.0',
    rating: 4.9,
    ratingCount: 94,
    installCount: 1677,
    tags: ['linear', 'project-management', 'mcp', 'issues', 'triage'],
    publishedAt: '2025-12-18',
    featured: true,
  },
  {
    id: 'mcp-notion',
    name: 'Notion MCP',
    category: 'mcp-integration',
    description: 'Read and write Notion pages, databases, and blocks from any connected agent.',
    longDescription:
      'Exposes Notion as an MCP server so agents can read pages, query databases, create new pages, and append content blocks. Supports rich content types: paragraphs, code blocks, tables, callouts, and toggles. Great for agents that need to maintain living documents, wikis, or project trackers in Notion.',
    author: 'community',
    version: '1.0.3',
    rating: 4.5,
    ratingCount: 62,
    installCount: 1189,
    tags: ['notion', 'documentation', 'database', 'mcp', 'knowledge-base'],
    publishedAt: '2026-01-30',
  },

  // Workflows (2)
  {
    id: 'workflow-sprint-kickoff',
    name: 'Sprint Kickoff',
    category: 'workflow',
    description: 'End-to-end sprint setup: create sprint, assign agents, set goals, post to Slack.',
    longDescription:
      'A multi-step workflow that automates your sprint kickoff. It creates a new sprint in Agent OS, pulls open issues from Linear, scores and prioritizes them by impact, assigns tasks to available agents based on their type and workload, generates a sprint goal statement, and posts a kickoff summary to your Slack standup channel. Reduces 45-minute meetings to 2 minutes.',
    author: 'space-agent-os',
    version: '1.2.0',
    rating: 4.7,
    ratingCount: 44,
    installCount: 723,
    tags: ['sprint', 'planning', 'linear', 'slack', 'agile'],
    publishedAt: '2026-02-20',
  },
  {
    id: 'workflow-daily-standup',
    name: 'Daily Standup',
    category: 'workflow',
    description: 'Auto-collect agent status updates and post a formatted standup to Slack.',
    longDescription:
      'Runs on a morning schedule (configurable timezone). Queries all active agents for their current task, last completed task, and any blockers. Formats the results into a clean Slack standup post with per-agent sections, a summary of what shipped yesterday, and what\'s in progress today. Links to relevant Linear issues and task logs.',
    author: 'space-agent-os',
    version: '1.0.1',
    rating: 4.6,
    ratingCount: 38,
    installCount: 654,
    tags: ['standup', 'slack', 'daily', 'scheduled', 'status'],
    publishedAt: '2026-03-05',
  },

  // GitHub Action (1)
  {
    id: 'action-agent-os-deploy',
    name: 'Agent OS Deploy',
    category: 'github-action',
    description: 'GitHub Action to deploy Agent OS updates and sync workspace configs on push.',
    longDescription:
      'A composable GitHub Action for CI/CD of your Agent OS workspace. On push to main, it builds your dashboard, runs migrations, deploys to Railway (or Vercel), syncs agent configs from your repo to the live workspace, and runs a smoke test. Configurable via action inputs. Supports staging → production promotion gating with manual approval.',
    author: 'space-agent-os',
    version: '1.0.0',
    rating: 4.8,
    ratingCount: 31,
    installCount: 509,
    tags: ['github-actions', 'ci-cd', 'deployment', 'railway', 'vercel'],
    publishedAt: '2026-03-18',
  },
]

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES: { id: MarketplaceCategory | 'all'; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'agent-template', label: 'Agent Templates', icon: Bot },
  { id: 'skill', label: 'Skills', icon: Zap },
  { id: 'script-utility', label: 'Scripts', icon: FileCode2 },
  { id: 'mcp-integration', label: 'MCPs', icon: Puzzle },
  { id: 'workflow', label: 'Workflows', icon: GitBranch },
  { id: 'github-action', label: 'GitHub Actions', icon: Play },
]

const CATEGORY_COLORS: Record<MarketplaceCategory, string> = {
  'agent-template': 'text-brand-400 bg-brand-500/10 ring-brand-500/20',
  'skill': 'text-purple-400 bg-purple-500/10 ring-purple-500/20',
  'workflow': 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
  'playwright-script': 'text-orange-400 bg-orange-500/10 ring-orange-500/20',
  'mcp-integration': 'text-yellow-400 bg-yellow-500/10 ring-yellow-500/20',
  'github-action': 'text-gray-400 bg-gray-500/10 ring-gray-500/20',
  'script-utility': 'text-pink-400 bg-pink-500/10 ring-pink-500/20',
}

const CATEGORY_ICONS: Record<MarketplaceCategory, React.ElementType> = {
  'agent-template': Bot,
  'skill': Zap,
  'workflow': GitBranch,
  'playwright-script': Play,
  'mcp-integration': Puzzle,
  'github-action': Play,
  'script-utility': FileCode2,
}

function categoryLabel(cat: MarketplaceCategory): string {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? cat
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={clsx(
              'w-3 h-3',
              star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'
            )}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">{rating.toFixed(1)} ({count})</span>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ item, onClose }: { item: MarketplaceItem; onClose: () => void }) {
  const Icon = CATEGORY_ICONS[item.category]
  const colorClass = CATEGORY_COLORS[item.category]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-gray-800">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colorClass.split(' ').slice(1).join(' '))}>
            <Icon className={clsx('w-6 h-6', colorClass.split(' ')[0])} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{item.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1', colorClass)}>
                    {categoryLabel(item.category)}
                  </span>
                  <span className="text-xs text-gray-500">v{item.version}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Stats row */}
          <div className="flex items-center gap-6">
            <StarRating rating={item.rating} count={item.ratingCount} />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Download className="w-3.5 h-3.5" />
              {item.installCount.toLocaleString()} installs
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed">{item.longDescription}</p>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{item.author}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              {new Date(item.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Tag className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-md font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-800 bg-gray-900/50">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Install
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
            <ExternalLink className="w-4 h-4" />
            Docs
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: MarketplaceItem; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[item.category]
  const colorClass = CATEGORY_COLORS[item.category]

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-800/50 transition-all duration-150 flex flex-col gap-3"
    >
      {/* Icon + category */}
      <div className="flex items-start justify-between">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', colorClass.split(' ').slice(1).join(' '))}>
          <Icon className={clsx('w-5 h-5', colorClass.split(' ')[0])} />
        </div>
        {item.featured && (
          <span className="px-1.5 py-0.5 bg-brand-500/10 text-brand-400 text-[10px] font-medium rounded ring-1 ring-brand-500/20">
            Featured
          </span>
        )}
      </div>

      {/* Name + category */}
      <div>
        <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
          {item.name}
        </h3>
        <span className={clsx('inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ring-1', colorClass)}>
          {categoryLabel(item.category)}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 flex-1">
        {item.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <StarRating rating={item.rating} count={item.ratingCount} />
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Download className="w-3 h-3" />
          {item.installCount >= 1000
            ? `${(item.installCount / 1000).toFixed(1)}k`
            : item.installCount}
        </div>
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MarketplaceItem | null>(null)

  const filtered = useMemo(() => {
    return ITEMS.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
      return matchCat && matchSearch
    })
  }, [activeCategory, search])

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: ITEMS.length }
    ITEMS.forEach((item) => {
      map[item.category] = (map[item.category] ?? 0) + 1
    })
    return map
  }, [])

  return (
    <>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Top nav bar */}
        <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mr-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold">Marketplace</span>
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full max-w-xs hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search templates, skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Hero */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Agent OS Marketplace
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
              Install agent templates, skills, workflows, and integrations to supercharge your workspace.
            </p>
          </div>

          {/* Mobile search */}
          <div className="relative mb-6 sm:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-8 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as MarketplaceCategory | 'all')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                  <span className={clsx(
                    'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-500'
                  )}>
                    {counts[cat.id] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Results count */}
          <p className="text-xs text-gray-500 mb-4">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            {search && <span> for &ldquo;{search}&rdquo;</span>}
          </p>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Search className="w-10 h-10 text-gray-700 mb-4" />
              <p className="text-gray-400 font-medium">No results found</p>
              <p className="text-sm text-gray-600 mt-1">Try a different search or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <ItemCard key={item.id} item={item} onClick={() => setSelected(item)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
