'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Bot,
  Brain,
  Cpu,
  Terminal,
  Clock,
  Layers,
  Users,
  GitBranch,
  Calendar,
  Building2,
  FolderOpen,
  Zap,
  Globe,
  Server,
  Code2,
  LogIn,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  role: string
  tier: string
  model: string
  provider: string
  description: string
  status: string
}

interface BrainDomain {
  id: string
  name: string
  path: string
  description: string
  doc_count: number
  icon: string
}

interface ModelConfig {
  id: string
  name: string
  short_name: string
  tier: string
  provider: string
  use_case: string
  context_window: number
  mode: string
  routing_rule: string
  status: string
}

interface SystemHealth {
  status: string
  system: string
  persona: string
  version: string
  timestamp: string
  agents_total: number
  model_tiers: number
  brain_domains: number
}

// ─── Static fallback data (shown instantly, no loading flicker) ───────────────

const AGENTS: Agent[] = [
  { id: 'context-agent', name: 'ContextAgent', role: 'Context Management', tier: 'primary', model: 'claude-sonnet-4-6', provider: 'OpenClaw', description: 'Maintains conversation context and surfaces relevant memory.', status: 'idle' },
  { id: 'pm-agent', name: 'PMAgent', role: 'Project Management', tier: 'secondary', model: 'gemini-2.0-flash', provider: 'Google', description: 'Tracks tasks and sprints. Writes to TASKS.md and brain vault.', status: 'idle' },
  { id: 'planner-agent', name: 'PlannerAgent', role: 'Task Planning', tier: 'primary', model: 'claude-sonnet-4-6', provider: 'OpenClaw', description: 'Decomposes goals into executable plans with dependency graphs.', status: 'idle' },
  { id: 'researcher-agent', name: 'ResearcherAgent', role: 'Research & Synthesis', tier: 'secondary', model: 'gemini-2.0-flash', provider: 'Google', description: 'Searches web and synthesizes findings into structured notes.', status: 'idle' },
  { id: 'lead-architect-agent', name: 'LeadArchitectAgent', role: 'System Architecture', tier: 'orchestrator', model: 'claude-opus-4-6', provider: 'OpenClaw', description: 'Owns technical decisions, ADRs, and delegates to engineers.', status: 'idle' },
  { id: 'reviewer-agent', name: 'ReviewerAgent', role: 'Code Review', tier: 'primary', model: 'claude-sonnet-4-6', provider: 'OpenClaw', description: 'Reviews PRs for correctness, security, and style.', status: 'idle' },
  { id: 'backend-engineer-agent', name: 'BackendEngineerAgent', role: 'Backend Engineering', tier: 'primary', model: 'claude-sonnet-4-6', provider: 'OpenClaw', description: 'Builds APIs, workers, and data pipelines in Python + TypeScript.', status: 'idle' },
  { id: 'frontend-engineer-agent', name: 'FrontendEngineerAgent', role: 'Frontend Engineering', tier: 'primary', model: 'claude-sonnet-4-6', provider: 'OpenClaw', description: 'Builds React/Next.js UI and owns the design system.', status: 'idle' },
  { id: 'domain-agent', name: 'DomainAgent', role: 'Domain Expertise', tier: 'local', model: 'qwen3-coder:30b', provider: 'Ollama', description: 'Handles domain-specific tasks offline and privacy-sensitive workloads.', status: 'idle' },
]

const BRAIN_DOMAINS: BrainDomain[] = [
  { id: 'company', name: 'Company', path: 'brains/company/', description: 'Mission, tech stack, org context', doc_count: 4, icon: 'building' },
  { id: 'departments', name: 'Departments', path: 'brains/departments/', description: 'Engineering, marketing, planning, QA', doc_count: 8, icon: 'layers' },
  { id: 'projects', name: 'Projects', path: 'brains/projects/', description: 'Project-scoped context and specs', doc_count: 12, icon: 'folder' },
  { id: 'people', name: 'People', path: 'brains/people/', description: 'Team and contact profiles', doc_count: 6, icon: 'users' },
  { id: 'decisions', name: 'Decisions', path: 'brains/decisions/', description: 'ADRs and business decisions', doc_count: 9, icon: 'git-branch' },
  { id: 'daily', name: 'Daily Logs', path: 'brains/daily/', description: 'Append-only daily log', doc_count: 31, icon: 'calendar' },
]

const MODELS: ModelConfig[] = [
  { id: 'opus-orchestrator', name: 'Claude Opus 4.6', short_name: 'Opus', tier: 'orchestrator', provider: 'OpenClaw', use_case: 'All tasks — reasoning, code, planning, high-stakes decisions', context_window: 200000, mode: 'sync', routing_rule: 'Default for all agent tasks', status: 'online' },
  { id: 'gemma4-async', name: 'Gemma 4', short_name: 'gemma4', tier: 'secondary', provider: 'Google', use_case: 'Parallel async runs, very long context (>100k tokens)', context_window: 1000000, mode: 'async', routing_rule: 'Parallel runs or context > 100k tokens', status: 'online' },
  { id: 'qwen3-realtime', name: 'Qwen3-Coder 30B', short_name: 'qwen3-coder', tier: 'local', provider: 'Ollama', use_case: 'Offline work, cost-sensitive batch, privacy workloads', context_window: 32768, mode: 'real-time', routing_rule: 'OLLAMA_ENABLED=true or /local invocation', status: 'offline' },
  { id: 'codex-harness', name: 'Codex', short_name: 'codex', tier: 'tooling', provider: 'Claude Code Harness', use_case: 'Agentic coding tasks, file edits, repo-wide refactors', context_window: 200000, mode: 'sync', routing_rule: 'Inside Claude Code agent sessions', status: 'online' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false })
}

const TIER_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  orchestrator: { dot: 'bg-purple-400', badge: 'text-purple-400 bg-purple-400/10 border-purple-400/20', label: 'ORCH' },
  primary:      { dot: 'bg-sky-400',    badge: 'text-sky-400 bg-sky-400/10 border-sky-400/20',       label: 'PRIMARY' },
  secondary:    { dot: 'bg-amber-400',  badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'SECONDARY' },
  local:        { dot: 'bg-green-400',  badge: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'LOCAL' },
  tooling:      { dot: 'bg-rose-400',   badge: 'text-rose-400 bg-rose-400/10 border-rose-400/20',    label: 'TOOLING' },
}

const BRAIN_ICON_MAP: Record<string, React.ElementType> = {
  building:   Building2,
  layers:     Layers,
  folder:     FolderOpen,
  users:      Users,
  'git-branch': GitBranch,
  calendar:   Calendar,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const s = TIER_STYLES[tier] ?? TIER_STYLES.primary
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${s.badge}`}>
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-2 hover:bg-white/[0.06] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{agent.name}</p>
            <p className="text-[10px] text-white/40 font-mono truncate">{agent.role}</p>
          </div>
        </div>
        <TierBadge tier={agent.tier} />
      </div>
      <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">{agent.description}</p>
      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-[10px] font-mono text-white/30 truncate">{agent.model}</span>
        <span className="text-white/20">·</span>
        <span className="text-[10px] text-white/30">{agent.provider}</span>
      </div>
    </div>
  )
}

function ModelCard({ model }: { model: ModelConfig }) {
  const s = TIER_STYLES[model.tier] ?? TIER_STYLES.primary
  const isOnline = model.status === 'online'
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-3 hover:bg-white/[0.06] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{model.name}</p>
            <p className="text-[10px] text-white/40 font-mono">{model.provider}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <TierBadge tier={model.tier} />
          <span className={`flex items-center gap-1 text-[9px] font-mono ${isOnline ? 'text-green-400' : 'text-white/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-white/50 leading-relaxed">{model.use_case}</p>
      <div className="flex items-center gap-3 pt-0.5">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${s.badge}`}>{model.mode}</span>
        <span className="text-[10px] font-mono text-white/30">{formatCtx(model.context_window)} ctx</span>
      </div>
      <p className="text-[10px] text-white/25 font-mono leading-snug border-t border-white/5 pt-2">{model.routing_rule}</p>
    </div>
  )
}

function BrainCard({ domain, total }: { domain: BrainDomain; total: number }) {
  const IconComponent = BRAIN_ICON_MAP[domain.icon] ?? FolderOpen
  const pct = Math.round((domain.doc_count / total) * 100)
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-2 hover:bg-white/[0.06] transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <IconComponent className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{domain.name}</p>
          <p className="text-[9px] text-white/30 font-mono truncate">{domain.path}</p>
        </div>
        <span className="text-[18px] font-bold text-white/70 tabular-nums">{domain.doc_count}</span>
      </div>
      <p className="text-[10px] text-white/40 leading-relaxed">{domain.description}</p>
      <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const [now, setNow] = useState(new Date())
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const totalDocs = BRAIN_DOMAINS.reduce((s, d) => s + d.doc_count, 0)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Health check
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: SystemHealth) => {
        setHealth(data)
        setApiOnline(true)
      })
      .catch(() => setApiOnline(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#080a0e] text-white font-sans">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 py-3 bg-[#080a0e]/90 backdrop-blur border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-sky-600 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white font-mono">SPACE-AGENT-OS</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* System status pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono font-semibold text-green-400">ONLINE</span>
        </div>

        {/* API status */}
        {apiOnline !== null && (
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold ${apiOnline ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <Globe className="w-2.5 h-2.5" />
            API {apiOnline ? 'OK' : 'ERR'}
          </div>
        )}

        <div className="flex-1" />

        {/* Version */}
        <span className="hidden sm:block text-[10px] font-mono text-white/30">
          {health?.version ?? 'v1.0.0'}
        </span>

        <div className="hidden sm:block w-px h-4 bg-white/10" />

        {/* Clock */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
          <Clock className="w-3 h-3" />
          {formatTime(now)}
        </div>

        <div className="w-px h-4 bg-white/10" />

        <Link
          href="/login"
          className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 hover:text-white transition-colors"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
          <div>
            <p className="text-[11px] font-mono text-sky-400/80 uppercase tracking-widest mb-2">Mission Control</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Space-Claw
            </h1>
            <p className="text-white/40 text-sm mt-1">Your personal AI operating system</p>
          </div>
          <div className="flex flex-wrap gap-3 sm:ml-auto">
            <Stat icon={Bot} value={String(AGENTS.length)} label="Agents" color="text-sky-400" />
            <Stat icon={Cpu} value={String(MODELS.length)} label="Models" color="text-purple-400" />
            <Stat icon={Brain} value={String(totalDocs)} label="Brain docs" color="text-emerald-400" />
            <Stat icon={Zap} value={String(BRAIN_DOMAINS.length)} label="Domains" color="text-amber-400" />
          </div>
        </div>

        {/* ── Agent Roster ────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Bot} title="Agent Roster" count={AGENTS.length} color="text-sky-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {AGENTS.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>

        {/* ── Model Tiers ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Cpu} title="Model Tiers" count={MODELS.length} color="text-purple-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {MODELS.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        </section>

        {/* ── Brain Vault ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={Brain} title="Brain Vault" count={totalDocs} countLabel="docs" color="text-emerald-400" />
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/30">
              <Server className="w-3 h-3" />
              Obsidian · Space-Brain
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BRAIN_DOMAINS.map((domain) => (
              <BrainCard key={domain.id} domain={domain} total={totalDocs} />
            ))}
          </div>
        </section>

        {/* ── Routing Rules ────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Code2} title="Routing Logic" color="text-amber-400" />
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.05]">
            {[
              { rule: 'Default', desc: 'All tasks route to Claude Opus 4.6 via OpenClaw', tier: 'orchestrator' },
              { rule: 'Long context (>100k)', desc: 'Route to Gemma 4 async pipeline', tier: 'secondary' },
              { rule: 'Offline / privacy', desc: 'Route to Qwen3-Coder 30B on Ollama', tier: 'local' },
              { rule: 'Agent coding session', desc: 'Codex via Claude Code Harness', tier: 'tooling' },
            ].map(({ rule, desc, tier }) => (
              <div key={rule} className="flex items-start gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <TierBadge tier={tier} />
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-mono text-white/70">{rule}</span>
                  <span className="text-white/20 mx-2">→</span>
                  <span className="text-[12px] text-white/40">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] font-mono text-white/20">
            Space-Agent-OS · Built on Vercel + Supabase
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Open Dashboard
          </Link>
        </footer>
      </main>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Stat({ icon: Icon, value, label, color }: { icon: React.ElementType; value: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]">
      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
      <div>
        <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
        <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  countLabel = 'total',
  color,
}: {
  icon: React.ElementType
  title: string
  count?: number
  countLabel?: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {count !== undefined && (
        <span className="text-[11px] font-mono text-white/30">
          {count} {countLabel}
        </span>
      )}
    </div>
  )
}
