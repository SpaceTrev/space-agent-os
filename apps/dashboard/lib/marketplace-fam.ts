// ============================================================
// FAM Core Marketplace Items — 12 items seeded by FAM Core
// ============================================================

import type { MarketplaceItem, AgentTemplate } from './marketplace-types'

export const FAM_ITEMS: (MarketplaceItem | AgentTemplate)[] = [
  // ── Agents (4) ─────────────────────────────────────────────

  {
    id: 'fam-agent-central-brain',
    name: 'CentralBrain Orchestrator',
    description:
      'Top-level orchestrator that routes tasks to the right specialist, maintains context across sessions, and surfaces prioritized action items.',
    longDescription:
      'CentralBrain is the command hub of the FAM agent swarm. It receives raw goals, decomposes them into discrete tasks, assigns each task to the most qualified specialist agent based on model tier and capability, tracks cross-task dependencies, and maintains a persistent context thread across the full session. It reads from and writes to the claude-mem memory pipeline and updates TASKS.md on every state change.',
    category: 'agent-template',
    persona:
      'You are Space-Claw, a proactive senior AI orchestrator. You do not execute tasks yourself — you decompose, route, and coordinate. You are precise, opinionated, and always working from the highest-priority item in the queue.',
    includedSkills: ['task-decomposer', 'agent-router', 'context-summarizer', 'priority-ranker'],
    includedTools: ['supabase', 'claude-mem', 'tasks-md-writer', 'dispatch-api'],
    brainContext: ['company/tech-stack', 'departments/engineering', 'decisions/adr-log'],
    tier: 'orchestrator',
    tags: ['orchestrator', 'routing', 'context', 'memory', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 5.0,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '🧠',
    includedComponents: [
      'Task decomposition skill',
      'Agent routing logic',
      'Context summarizer skill',
      'Priority ranker (URGENT/HIGH/NORMAL/LOW)',
      'TASKS.md read/write integration',
      'claude-mem memory pipeline hook',
    ],
    requirements: ['Anthropic API key (Claude Opus 4.6 via OpenClaw)', 'Supabase project', 'claude-mem MCP'],
  } satisfies AgentTemplate,

  {
    id: 'fam-agent-context',
    name: 'Context Agent',
    description:
      'Manages conversation context and long-term memory. Surfaces relevant past decisions, project state, and people context before every agent response.',
    longDescription:
      'The Context Agent is the memory layer of the FAM swarm. Before any task executes, it queries claude-mem to pull the most relevant observations, decisions, and project notes. After each task completes, it writes a structured observation back to the memory store. It maintains a sliding context window optimized for Claude\'s 200k token limit and automatically summarizes older context to prevent degradation.',
    category: 'agent-template',
    persona:
      'You are a meticulous context manager. Your job is to ensure every agent in the swarm has exactly the right background information — no more, no less. You are the swarm\'s institutional memory.',
    includedSkills: ['memory-query', 'context-builder', 'observation-writer', 'context-compressor'],
    includedTools: ['claude-mem', 'supabase', 'brains-vault-search'],
    brainContext: ['company/', 'decisions/', 'people/'],
    tier: 'primary',
    tags: ['context', 'memory', 'claude-mem', 'fam-core', 'rag'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.9,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '📚',
    includedComponents: [
      'Memory query skill (claude-mem smart_search)',
      'Context builder (relevance-ranked)',
      'Observation writer skill',
      'Context compressor for long sessions',
      'Brain vault search integration',
    ],
    requirements: ['claude-mem MCP server', 'Supabase project', 'Anthropic API key'],
  } satisfies AgentTemplate,

  {
    id: 'fam-agent-chart-coach',
    name: 'Chart Coach (SMC/ICT)',
    description:
      'Trading assistant trained on Smart Money Concepts and ICT methodology. Identifies order blocks, FVGs, liquidity sweeps, and trade setups in real time.',
    longDescription:
      'Chart Coach is a specialized trading analysis agent grounded in Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology. Given a chart screenshot or OHLCV data, it identifies key structural elements: order blocks (OB), fair value gaps (FVG), breaker blocks, liquidity pools, market structure shifts (MSS), and change of character (ChoCH) events. It produces a structured trade plan with entry, stop-loss, and target levels, and flags confluence zones. Pairs with the Eval Trade Pattern Analysis skill for backtesting.',
    category: 'agent-template',
    persona:
      'You are an elite prop trader and chart analyst specializing in Smart Money Concepts and ICT methodology. You read price action at an institutional level. You are disciplined, precise, and never chase trades.',
    includedSkills: ['smc-pattern-detector', 'fvg-scanner', 'liquidity-mapper', 'trade-plan-generator'],
    includedTools: ['tradingview-cdp-mcp', 'pine-script-iterator', 'eval-trade-pattern'],
    brainContext: ['trading/smc-glossary', 'trading/ict-concepts', 'trading/risk-rules'],
    tier: 'primary',
    tags: ['trading', 'smc', 'ict', 'chart-analysis', 'order-blocks', 'fvg', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.8,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '📈',
    includedComponents: [
      'SMC pattern detector skill',
      'FVG scanner skill',
      'Liquidity pool mapper',
      'Trade plan generator (entry/SL/TP)',
      'Confluence zone highlighter',
      'TradingView CDP MCP integration',
    ],
    requirements: ['Anthropic API key', 'TradingView account (for CDP MCP)', 'OHLCV data feed'],
  } satisfies AgentTemplate,

  {
    id: 'fam-agent-researcher',
    name: 'Research Agent',
    description:
      'Deep research agent that searches the web, synthesizes findings into structured notes, and writes them to the brain vault.',
    longDescription:
      'The Research Agent performs multi-source research on any topic. It issues parallel web searches, reads full article content, deduplicates information, cross-validates claims, and synthesizes findings into a structured Obsidian note with proper YAML frontmatter. Output is written directly to the brain vault under brains/research/. Supports both broad discovery research and narrow fact-checking tasks.',
    category: 'agent-template',
    persona:
      'You are a rigorous research analyst. You never summarize without reading the source. You distinguish facts from opinions, cite everything, and structure findings for maximum reusability.',
    includedSkills: ['web-search', 'article-reader', 'synthesis-writer', 'vault-note-creator'],
    includedTools: ['perplexity', 'firecrawl', 'brains-vault-writer', 'claude-mem'],
    brainContext: ['research/', 'company/tech-stack'],
    tier: 'secondary',
    tags: ['research', 'web-search', 'synthesis', 'brain-vault', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.7,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '🔬',
    includedComponents: [
      'Web search skill (Perplexity)',
      'Full article reader (Firecrawl)',
      'Multi-source synthesis writer',
      'Brain vault note creator (Obsidian format)',
      'Claim cross-validator',
    ],
    requirements: ['Anthropic API key or Gemini API key', 'Perplexity API key', 'Firecrawl API key'],
  } satisfies AgentTemplate,

  // ── Skills (4) ─────────────────────────────────────────────

  {
    id: 'fam-skill-youtube-ingest',
    name: 'YouTube Transcript Ingest',
    description:
      'Fetches the full transcript of any YouTube video and stores it as a structured brain vault note, ready for agent context.',
    longDescription:
      'Pass a YouTube URL and this skill fetches the auto-generated or manual transcript via the YouTube Data API, chunks it intelligently, generates a summary, extracts key concepts and timestamps, and writes a structured Obsidian note to brains/research/ with full YAML frontmatter. Used by the Research Agent and Context Agent to ingest video content into the memory pipeline.',
    category: 'skill',
    tags: ['youtube', 'transcript', 'ingest', 'brain-vault', 'media', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.8,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '🎬',
    includedComponents: [
      'YouTube transcript fetcher (yt-dlp)',
      'Intelligent chunker',
      'Summary generator',
      'Key concept + timestamp extractor',
      'Brain vault note writer',
      'POST /ingest/youtube API endpoint',
    ],
    requirements: ['Python 3.12+', 'yt-dlp installed', 'Anthropic API key'],
  },

  {
    id: 'fam-skill-eval-trade-pattern',
    name: 'Eval Trade Pattern Analysis',
    description:
      'Backtests SMC/ICT trade setups across historical OHLCV data and returns win rate, RR distribution, and drawdown stats.',
    longDescription:
      'Given a defined trade setup (entry logic, stop-loss rule, target rule), this skill fetches historical OHLCV data, scans for setup occurrences, simulates fills, and returns a full performance report: win rate, average RR, max consecutive losses, max drawdown, and expectancy. Results are structured for the Chart Coach agent and optionally written to the brain vault as a research note. Pairs with Pine Script Iterator for TradingView validation.',
    category: 'skill',
    tags: ['trading', 'backtesting', 'smc', 'ict', 'performance', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.7,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '📊',
    includedComponents: [
      'OHLCV data fetcher',
      'Setup scanner engine',
      'Trade simulator (fills, SL, TP)',
      'Performance report generator',
      'Brain vault report writer',
      'Pine Script export helper',
    ],
    requirements: ['Python 3.12+', 'OHLCV data source (TradingView or Alpaca)', 'Anthropic API key'],
  },

  {
    id: 'fam-skill-session-report',
    name: 'Session Report Generator',
    description:
      'Generates a structured end-of-session report from agent command history, task outcomes, and memory observations.',
    longDescription:
      'At the end of any agent session, this skill queries the Supabase commands table for session activity, fetches the relevant claude-mem observations written during the session, and produces a structured Markdown report: tasks completed, decisions made, open items, and next actions. The report is appended to the daily brain vault note (brains/daily/YYYY-MM-DD.md) and optionally sent via email.',
    category: 'skill',
    tags: ['reporting', 'session', 'summary', 'brain-vault', 'daily-log', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.6,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '📋',
    includedComponents: [
      'Supabase command history fetcher',
      'claude-mem observation aggregator',
      'Structured report generator',
      'Daily brain vault appender',
      'Email delivery (optional)',
    ],
    requirements: ['Supabase project', 'claude-mem MCP', 'Anthropic API key'],
  },

  {
    id: 'fam-skill-pine-script-iterator',
    name: 'Pine Script Iterator',
    description:
      'Generates, tests, and iterates Pine Script strategies on TradingView by progressively refining indicator logic based on backtest results.',
    longDescription:
      'Give this skill a strategy description in plain English and it generates an initial Pine Script v5 implementation, submits it to TradingView via the CDP MCP, reads back the backtest results, identifies weaknesses, and iterates the script up to N times to optimize performance. Each iteration is logged with a diff and rationale. Final script is saved to the brain vault.',
    category: 'skill',
    tags: ['trading', 'pine-script', 'tradingview', 'strategy', 'iteration', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.5,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '🔁',
    includedComponents: [
      'Pine Script v5 generator',
      'TradingView CDP MCP integration',
      'Backtest result parser',
      'Strategy diff & rationale logger',
      'Iterative optimizer (up to N rounds)',
      'Brain vault strategy saver',
    ],
    requirements: ['TradingView Pro+ account', 'TradingView CDP MCP', 'Anthropic API key'],
  },

  // ── Automations (2) ────────────────────────────────────────

  {
    id: 'fam-automation-supabase-sync',
    name: 'Supabase Sync Daemon',
    description:
      'Background daemon that polls the Supabase commands table every 30s and dispatches pending commands to the appropriate agent workers.',
    longDescription:
      'The Supabase Sync Daemon is the heartbeat of the FAM agent backend. It runs as a persistent Python process (managed by uv), polls the commands table for pending/queued entries, matches each command to the right agent worker based on payload.agent, dispatches the task, and writes back status + result on completion. It also writes heartbeat events to the system_state table for Mission Control monitoring.',
    category: 'workflow',
    tags: ['supabase', 'daemon', 'polling', 'dispatch', 'heartbeat', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.9,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '⚡',
    includedComponents: [
      'Supabase commands table poller (30s interval)',
      'Agent worker dispatcher',
      'Status + result writer',
      'Heartbeat → system_state writer',
      'Error recovery with exponential backoff',
    ],
    requirements: ['Python 3.12+', 'uv package manager', 'Supabase project with commands table'],
  },

  {
    id: 'fam-automation-claude-mem-pipeline',
    name: 'claude-mem Memory Pipeline',
    description:
      'Wires claude-mem as the unified long-term memory layer: observations flow in from all agents and are indexed for semantic search.',
    longDescription:
      'The claude-mem Memory Pipeline is the glue between every FAM agent and the persistent memory store. It exposes a standardized interface for agents to write observations (build_corpus, prime_corpus) and query them (smart_search, query_corpus). It maintains a corpus per project, rebuilds indices on schedule, and prunes stale observations beyond the retention window. Includes a health endpoint for Mission Control.',
    category: 'workflow',
    tags: ['memory', 'claude-mem', 'mcp', 'rag', 'observations', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.8,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '🗄️',
    includedComponents: [
      'claude-mem MCP server integration',
      'Corpus builder (build_corpus / prime_corpus)',
      'Semantic search wrapper (smart_search)',
      'Scheduled index rebuilder',
      'Stale observation pruner',
      'Health endpoint for Mission Control',
    ],
    requirements: ['claude-mem MCP server', 'Anthropic API key', 'Python 3.12+'],
  },

  // ── Integrations (2) ───────────────────────────────────────

  {
    id: 'fam-integration-tradingview-cdp',
    name: 'TradingView CDP MCP',
    description:
      'MCP server exposing TradingView Chart Data Protocol tools: read live charts, submit Pine Scripts, and fetch backtest results from agents.',
    longDescription:
      'The TradingView CDP MCP wraps the TradingView Chart Data Protocol as a set of MCP tools accessible to any agent. Tools include: read_chart (fetch OHLCV + indicator data for any symbol/timeframe), submit_pine_script (deploy a strategy to a chart), get_backtest_results (parse performance metrics), and get_alerts (read active price alerts). Used by Chart Coach and Pine Script Iterator. Requires TradingView Pro+ for strategy backtesting.',
    category: 'mcp-integration',
    tags: ['tradingview', 'mcp', 'cdp', 'pine-script', 'charts', 'trading', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.7,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '📡',
    includedComponents: [
      'read_chart tool (OHLCV + indicators)',
      'submit_pine_script tool',
      'get_backtest_results tool',
      'get_alerts tool',
      'list_watchlist tool',
      'MCP stdio server (Node.js)',
    ],
    requirements: ['TradingView Pro+ account', 'TradingView session cookie', 'Node.js 18+'],
  },

  {
    id: 'fam-integration-google-stitch',
    name: 'Google Stitch MCP',
    description:
      'MCP server for Google Workspace: read/write Docs, Sheets, Drive files, and Calendar events directly from any agent.',
    longDescription:
      'The Google Stitch MCP exposes Google Workspace as MCP tools, giving agents direct read/write access to the entire Google ecosystem. Tools include Docs (read, write, append), Sheets (read range, write range, create sheet), Drive (list, read file, upload), Calendar (list events, create event, update event), and Gmail (read threads, send message). Authentication uses OAuth2 with token refresh. Designed for the FAM Core agent swarm but compatible with any MCP client.',
    category: 'mcp-integration',
    tags: ['google', 'workspace', 'mcp', 'docs', 'sheets', 'drive', 'calendar', 'fam-core'],
    author: 'FAM Core',
    version: '1.0.0',
    rating: 4.6,
    installCount: 1,
    pricing: { model: 'free' },
    icon: '🔗',
    includedComponents: [
      'Google Docs read/write/append tools',
      'Google Sheets read/write tools',
      'Google Drive list/read/upload tools',
      'Google Calendar CRUD tools',
      'Gmail read/send tools',
      'OAuth2 token manager',
      'MCP stdio server (Node.js)',
    ],
    requirements: ['Google Cloud project', 'OAuth2 credentials (client_id + client_secret)', 'Node.js 18+'],
  },
]

// Lookup by ID
export function getFamItem(id: string) {
  return FAM_ITEMS.find((item) => item.id === id)
}
