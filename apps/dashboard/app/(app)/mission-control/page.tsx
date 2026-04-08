'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Terminal,
  Activity,
  Bot,
  Zap,
  Radio,
  GitBranch,
  Clock,
  MessageSquare,
  Cpu,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-react'

// ─── Backend types ────────────────────────────────────────────────────────────

interface ServiceHealth {
  reachable?: boolean
  configured?: boolean
  models?: string[]
  version?: string
  status?: string
}

interface HealthData {
  status: string
  timestamp?: string
  backend?: Record<string, string>
  services?: {
    ollama?: ServiceHealth
    openclaw?: ServiceHealth
    anthropic?: ServiceHealth
    gemini?: ServiceHealth
    [key: string]: ServiceHealth | undefined
  }
}

interface AgentData {
  name: string
  role: string
  tier: string
  module?: string
  status?: string
}

interface ModelsData {
  ollama_reachable?: boolean
  ollama_models?: string[]
  models?: string[]
}

// ─── UI types ─────────────────────────────────────────────────────────────────

type TaskStatus = 'running' | 'done' | 'error' | 'queued' | 'pending'

interface PipelineTask {
  id: string
  description: string
  model: string
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
  status: TaskStatus
  elapsed_s: number | null
  started_at: string
}

interface DiscordMessage {
  id: string
  author: string
  content: string
  ts: string
  type: 'command' | 'message' | 'bot'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

const statusIcon = (status: TaskStatus) => {
  switch (status) {
    case 'running':
      return <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />
    case 'done':
      return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />
    case 'queued':
      return <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
    default:
      return <Circle className="w-3.5 h-3.5 text-text-muted" />
  }
}

const priorityBadge: Record<string, string> = {
  URGENT: 'text-red-500 bg-red-500/10',
  HIGH: 'text-orange-500 bg-orange-500/10',
  NORMAL: 'text-text-secondary bg-border-base',
  LOW: 'text-text-muted bg-border-base',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ online, label }: { online: boolean; label: string }) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border',
      online
        ? 'text-green-500 bg-green-500/10 border-green-500/20'
        : 'text-text-muted bg-surface border-border-base'
    )}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full',
        online ? 'bg-green-500 animate-pulse' : 'bg-text-muted'
      )} />
      {label}
    </div>
  )
}

function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border text-red-400 bg-red-500/10 border-red-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      LIVE
    </div>
  )
}

function ServiceRow({ name, svc }: { name: string; svc: ServiceHealth }) {
  const reachable = svc.reachable ?? svc.configured ?? false
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border-base last:border-0">
      <div className="flex items-center gap-2">
        {reachable
          ? <Wifi className="w-3 h-3 text-green-500" />
          : <WifiOff className="w-3 h-3 text-text-muted" />}
        <span className="text-[11px] font-mono text-text-primary capitalize">{name}</span>
      </div>
      <span className={clsx(
        'text-[10px] font-mono font-medium',
        reachable ? 'text-green-500' : 'text-text-muted'
      )}>
        {reachable ? 'reachable' : 'offline'}
      </span>
    </div>
  )
}

function DispatchModal({ onClose, onSend }: { onClose: () => void; onSend: (task: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border-base rounded-xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
          <Send className="w-4 h-4 text-accent" />
          Dispatch Task
        </h3>
        <p className="text-xs text-text-muted mb-4">Sent to the worker queue via CentralBrain</p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Describe the task... e.g. 'Refactor the orchestrator to use async generators'"
          className="w-full bg-background border border-border-base rounded-lg p-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none font-mono"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (text.trim()) { onSend(text.trim()); onClose() } }}
            className="px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
          >
            Dispatch
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const [now, setNow] = useState(new Date())
  const [tasks, setTasks] = useState<PipelineTask[]>([])
  const [discordMessages] = useState<DiscordMessage[]>([
    {
      id: '1',
      author: 'Space-Claw',
      content: '🤖 **Space-Claw online.** Type `/ask` or mention me to start.',
      ts: new Date(Date.now() - 900000).toISOString(),
      type: 'bot',
    },
  ])
  const [showDispatch, setShowDispatch] = useState(false)
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null)
  const [botConnected] = useState(false)

  // Backend data state
  const [health, setHealth] = useState<HealthData | null>(null)
  const [agents, setAgents] = useState<AgentData[]>([])
  const [modelsData, setModelsData] = useState<ModelsData | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const feedRef = useRef<HTMLDivElement>(null)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll task feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [tasks])

  // Fetch all backend data
  const fetchAll = useCallback(async () => {
    // Fetch health
    try {
      const res = await fetch('/api/ops?path=health', { cache: 'no-store' })
      if (res.ok) {
        const data: HealthData = await res.json()
        setHealth(data)
        setBackendOnline(true)
        setLastHeartbeat(new Date())
        setFetchError(null)
      } else {
        setBackendOnline(false)
        setFetchError(`HTTP ${res.status}`)
      }
    } catch (e) {
      setBackendOnline(false)
      setFetchError(e instanceof Error ? e.message : 'unreachable')
    }

    // Fetch agents
    try {
      const res = await fetch('/api/ops?path=agents', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        // Handle {agents: [...]} or bare array
        const list: AgentData[] = Array.isArray(data) ? data : (data.agents ?? [])
        setAgents(list)
      }
    } catch {
      // agents remain empty
    }

    // Fetch models
    try {
      const res = await fetch('/api/ops?path=models', { cache: 'no-store' })
      if (res.ok) {
        const data: ModelsData = await res.json()
        setModelsData(data)
      }
    } catch {
      // models remain null
    }

    setLastFetched(new Date())
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 10_000)
    return () => clearInterval(t)
  }, [fetchAll])

  // Build agent pipeline tasks from real agents data
  useEffect(() => {
    if (agents.length === 0) return
    const agentTasks: PipelineTask[] = agents.map((a, i) => ({
      id: a.module ?? `agent-${i}`,
      description: `${a.role} — ${a.name}`,
      model: a.tier === 'local' ? 'ollama' : a.tier === 'primary' ? 'claude-sonnet-4-6' : 'gemini-2.0-flash',
      priority: 'NORMAL',
      status: (a.status === 'running' ? 'running' : a.status === 'error' ? 'error' : 'done') as TaskStatus,
      elapsed_s: null,
      started_at: new Date(Date.now() - (i + 1) * 60000).toISOString(),
    }))
    setTasks(agentTasks)
  }, [agents])

  async function handleDispatch(description: string) {
    const taskId = `task-${Date.now()}`
    setTasks((prev) => [{
      id: taskId,
      description,
      model: 'space-claw',
      priority: 'NORMAL',
      status: 'running',
      elapsed_s: null,
      started_at: new Date().toISOString(),
    }, ...prev])

    try {
      const res = await fetch('/api/ops?path=dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: description, channel: 'mission-control' }),
      })
      const data = await res.json()
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: (data.error ? 'error' : 'done') as TaskStatus, elapsed_s: data.elapsed_s ?? null }
            : t
        )
      )
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'error' as TaskStatus } : t))
      )
    }
  }

  // Derive service statuses from health
  const services = health?.services ?? {}
  const ollamaOnline = services.ollama?.reachable ?? false
  const openclawOnline = services.openclaw?.reachable ?? false
  const anthropicOnline = services.anthropic?.configured ?? services.anthropic?.reachable ?? false
  const geminiOnline = services.gemini?.configured ?? services.gemini?.reachable ?? false

  // Ollama models — prefer /models endpoint, fall back to /health services.ollama.models
  const ollamaModels: string[] = modelsData?.ollama_models
    ?? modelsData?.models
    ?? services.ollama?.models
    ?? []

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/* ── System Status Bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 bg-surface border-b border-border-base">
        <div className="flex items-center gap-2 mr-2">
          <Terminal className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-text-primary font-mono">MISSION CONTROL</span>
        </div>

        <div className="h-4 w-px bg-border-base" />

        <LiveBadge />

        <div className="h-4 w-px bg-border-base" />

        {/* Heartbeat */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span className="text-text-secondary">HB</span>
          <span className="text-accent">{lastHeartbeat ? timeAgo(lastHeartbeat.toISOString()) : '—'}</span>
        </div>

        <div className="h-4 w-px bg-border-base" />

        {/* Real service pills */}
        <div className="flex items-center gap-2">
          <StatusPill online={backendOnline === true} label="Backend" />
          <StatusPill online={openclawOnline} label="OpenClaw" />
          <StatusPill online={anthropicOnline} label="Anthropic" />
          <StatusPill online={geminiOnline} label="Gemini" />
          <StatusPill online={ollamaOnline} label="Ollama" />
        </div>

        <div className="flex-1" />

        {/* Fetch error */}
        {fetchError && (
          <span className="text-[10px] font-mono text-red-400 truncate max-w-[200px]">{fetchError}</span>
        )}

        {/* Last fetched */}
        {lastFetched && (
          <span className="text-[10px] font-mono text-text-muted">↻ {timeAgo(lastFetched.toISOString())}</span>
        )}

        <div className="h-4 w-px bg-border-base" />

        {/* Live clock */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
          <Clock className="w-3 h-3" />
          {formatTime(now)}
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden min-h-0">

        {/* ── Left: Agent Pipeline (2/3) ─────────────────────────────────── */}
        <div className="col-span-2 flex flex-col border-r border-border-base overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border-base">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">Agent Pipeline</span>
              <span className="text-xs text-text-muted font-mono ml-1">{agents.length > 0 ? `${agents.length} agents` : `${tasks.length} tasks`}</span>
              {backendOnline === true && (
                <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">live</span>
              )}
            </div>
            <button
              onClick={() => setShowDispatch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Send className="w-3 h-3" />
              Dispatch
            </button>
          </div>

          {/* Backend info strip */}
          {health?.backend && (
            <div className="flex-shrink-0 flex items-center gap-4 px-5 py-2 bg-green-500/5 border-b border-green-500/10 overflow-x-auto">
              {Object.entries(health.backend).map(([k, v]) => (
                <span key={k} className="text-[10px] font-mono text-text-muted whitespace-nowrap">
                  <span className="text-green-500/70">{k}:</span> {v}
                </span>
              ))}
            </div>
          )}

          {/* Task/agent feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto">
            {backendOnline === null ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
                <RefreshCw className="w-6 h-6 animate-spin opacity-30" />
                <p className="text-sm">Connecting to backend...</p>
              </div>
            ) : backendOnline === false ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
                <WifiOff className="w-6 h-6 opacity-30" />
                <p className="text-sm">Backend offline</p>
                {fetchError && <p className="text-xs font-mono text-red-400">{fetchError}</p>}
                <button
                  onClick={fetchAll}
                  className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
                <RefreshCw className="w-6 h-6 animate-spin opacity-30" />
                <p className="text-sm">Loading agents...</p>
              </div>
            ) : (
              <div className="divide-y divide-border-base">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="mt-0.5 flex-shrink-0">{statusIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate leading-snug">{task.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-mono text-text-muted">{task.id}</span>
                        <span className="text-[10px] font-mono text-accent/80">{task.model}</span>
                        {task.elapsed_s !== null && (
                          <span className="text-[10px] font-mono text-text-muted">{task.elapsed_s}s</span>
                        )}
                        <span className="text-[10px] text-text-muted">{timeAgo(task.started_at)}</span>
                      </div>
                    </div>
                    <span className={clsx(
                      'flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded font-mono',
                      priorityBadge[task.priority]
                    )}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ───────────────────────────────────────────────── */}
        <div className="col-span-1 flex flex-col overflow-hidden">

          {/* Service Health (top quarter) */}
          <div className="flex-shrink-0 border-b border-border-base">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-text-primary">Services</span>
              </div>
              {health?.status && (
                <span className={clsx(
                  'text-[10px] font-mono font-medium px-2 py-0.5 rounded',
                  health.status === 'ok' || health.status === 'healthy'
                    ? 'text-green-500 bg-green-500/10'
                    : 'text-yellow-500 bg-yellow-500/10'
                )}>
                  {health.status}
                </span>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto">
              {Object.keys(services).length === 0 ? (
                <div className="px-4 py-3 text-[11px] text-text-muted font-mono">
                  {backendOnline === null ? 'Connecting...' : 'No service data'}
                </div>
              ) : (
                Object.entries(services).map(([name, svc]) =>
                  svc ? <ServiceRow key={name} name={name} svc={svc} /> : null
                )
              )}
            </div>
          </div>

          {/* Discord Activity (middle) */}
          <div className="flex-1 flex flex-col border-b border-border-base overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-text-primary">Discord</span>
              </div>
              <div className={clsx(
                'flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border',
                botConnected
                  ? 'text-green-500 bg-green-500/10 border-green-500/20'
                  : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
              )}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', botConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500')} />
                {botConnected ? 'ONLINE' : 'INVITE BOT'}
              </div>
            </div>

            {!botConnected && (
              <div className="px-4 py-3 bg-yellow-500/5 border-b border-yellow-500/10">
                <p className="text-[11px] text-yellow-500/80 leading-snug">Bot not in server yet.</p>
                <a
                  href="https://discord.com/oauth2/authorize?client_id=1484792458981412894&scope=bot+applications.commands&permissions=277025770560"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 mt-1 font-mono underline underline-offset-2"
                >
                  discord.com/oauth2/authorize
                  <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="px-4 py-2 border-b border-border-base flex flex-wrap gap-1.5">
              {['/ask', '/status', '/tasks', '/swarm'].map((cmd) => (
                <span key={cmd} className="text-[10px] font-mono px-1.5 py-0.5 bg-background text-text-secondary rounded border border-border-base">{cmd}</span>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-border-base">
                {discordMessages.map((msg) => (
                  <div key={msg.id} className="px-4 py-2.5 hover:bg-surface">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={clsx(
                        'text-[11px] font-semibold',
                        msg.type === 'bot' ? 'text-accent' : 'text-text-primary'
                      )}>
                        {msg.author}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">{timeAgo(msg.ts)}</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ollama Models (bottom) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-text-primary">Ollama Models</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'text-[10px] font-mono',
                  ollamaOnline ? 'text-green-500' : 'text-text-muted'
                )}>
                  {ollamaOnline ? `${ollamaModels.length} installed` : 'offline'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border-base">
              {ollamaModels.length === 0 ? (
                <div className="px-4 py-3 text-[11px] text-text-muted font-mono">
                  {backendOnline === null ? 'Loading...' : ollamaOnline ? 'No models found' : 'Ollama unreachable'}
                </div>
              ) : (
                ollamaModels.map((model) => {
                  const isLarge = /30b|31b|32b|70b/i.test(model)
                  const isCoder = /coder/i.test(model)
                  const isReasoning = /r1|thinking/i.test(model)
                  return (
                    <div key={model} className="px-4 py-2.5 hover:bg-surface flex items-center justify-between">
                      <span className="text-[11px] font-mono text-text-primary truncate max-w-[160px]">{model}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isLarge && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">30B+</span>
                        )}
                        {isCoder && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-accent/10 text-accent">code</span>
                        )}
                        {isReasoning && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400">think</span>
                        )}
                        <span className="text-[9px] font-mono text-green-500">●</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions strip ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 bg-surface border-t border-border-base">
        <span className="text-[11px] font-mono text-text-muted mr-1 uppercase tracking-wider">Quick actions</span>
        {[
          { label: 'Start Heartbeat', icon: Activity, color: 'text-accent' },
          { label: 'Orchestrator Smoke', icon: Bot, color: 'text-green-500' },
          { label: 'View TASKS.md', icon: GitBranch, color: 'text-yellow-500' },
          { label: 'Git Status', icon: GitBranch, color: 'text-purple-400' },
          { label: 'Discord Status', icon: MessageSquare, color: 'text-indigo-400' },
        ].map(({ label, icon: Icon, color }) => (
          <button
            key={label}
            onClick={() => {
              console.log('action:', label)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-background hover:bg-border-base border border-border-base hover:border-text-muted text-xs text-text-secondary hover:text-text-primary rounded-lg transition-all font-mono"
          >
            <Icon className={clsx('w-3 h-3', color)} />
            {label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Backend URL indicator */}
        <span className="text-[10px] font-mono text-text-muted truncate max-w-[300px]">
          api: {process.env.NEXT_PUBLIC_API_URL ?? 'localhost:8000'}
        </span>
      </div>

      {/* ── Dispatch modal ─────────────────────────────────────────────────── */}
      {showDispatch && (
        <DispatchModal
          onClose={() => setShowDispatch(false)}
          onSend={handleDispatch}
        />
      )}
    </div>
  )
}
