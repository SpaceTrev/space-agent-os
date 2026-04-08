'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Terminal,
  Activity,
  Bot,
  Zap,
  Clock,
  Cpu,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
  Server,
  Layers,
  Wifi,
  WifiOff,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface AgentEntry {
  name: string
  role: string
  tier: string
  status: string
}

interface HealthServices {
  ollama: { reachable: boolean; url: string; models: string[] }
  openclaw: { reachable: boolean; url: string; enabled: boolean }
  anthropic: { configured: boolean }
  gemini: { configured: boolean }
}

interface HealthData {
  status: string
  timestamp: number
  services: HealthServices
  backend: string
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

const tierColor: Record<string, string> = {
  orchestrator: 'text-accent',
  architect: 'text-purple-400',
  worker: 'text-green-500',
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

function LiveBadge({ live }: { live: boolean }) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border uppercase tracking-widest',
      live
        ? 'text-red-400 bg-red-500/10 border-red-500/30'
        : 'text-text-muted bg-surface border-border-base'
    )}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full',
        live ? 'bg-red-400 animate-pulse' : 'bg-text-muted'
      )} />
      {live ? 'LIVE' : 'OFFLINE'}
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
  const [agents, setAgents] = useState<AgentEntry[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [isLive, setIsLive] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [showDispatch, setShowDispatch] = useState(false)
  const [loading, setLoading] = useState(true)
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

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, agentsRes, tasksRes] = await Promise.allSettled([
        fetch('/api/ops?path=health', { cache: 'no-store' }),
        fetch('/api/ops?path=agents', { cache: 'no-store' }),
        fetch('/api/ops?path=tasks', { cache: 'no-store' }),
      ])

      // Health
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const h: HealthData = await healthRes.value.json()
        setHealth(h)
        setIsLive(h.status === 'ok')
        setLastFetch(new Date())
        setOllamaModels(h.services.ollama.models ?? [])
      } else {
        setIsLive(false)
      }

      // Agents
      if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) {
        const a = await agentsRes.value.json()
        setAgents(a.agents ?? [])
      }

      // Tasks (from TASKS.md)
      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const t = await tasksRes.value.json()
        const realTasks: PipelineTask[] = (t.tasks ?? []).map((task: {
          id: string; priority: string; description: string; status: string
        }) => ({
          id: task.id,
          description: task.description,
          model: 'space-claw',
          priority: task.priority as PipelineTask['priority'],
          status: 'queued' as TaskStatus,
          elapsed_s: null,
          started_at: new Date().toISOString(),
        }))
        setTasks(realTasks)
      }
    } catch {
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 10_000)
    return () => clearInterval(t)
  }, [fetchAll])

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

  const ollamaOnline = health?.services.ollama.reachable ?? false
  const anthropicOk = health?.services.anthropic.configured ?? false
  const geminiOk = health?.services.gemini.configured ?? false

  // Build combined model list: API models + real Ollama models
  const apiModels = [
    { name: 'claude-sonnet-4-6', tier: 'primary', provider: 'Anthropic', online: anthropicOk },
    { name: 'gemini-2.0-flash', tier: 'secondary', provider: 'Google', online: geminiOk },
  ]
  const localModels = ollamaModels.map((m) => ({
    name: m,
    tier: 'local',
    provider: 'Ollama',
    online: ollamaOnline,
  }))
  const allModels = [...apiModels, ...localModels]

  const tierLabel: Record<string, string> = {
    primary: 'text-accent',
    secondary: 'text-purple-500',
    local: 'text-green-500',
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/* ── System Status Bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 bg-surface border-b border-border-base">
        <div className="flex items-center gap-2 mr-2">
          <Terminal className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-text-primary font-mono">MISSION CONTROL</span>
        </div>

        <div className="h-4 w-px bg-border-base" />

        <LiveBadge live={isLive} />

        <div className="h-4 w-px bg-border-base" />

        {/* Last fetch */}
        {lastFetch && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span className="text-text-secondary">synced</span>
            <span className="text-accent">{timeAgo(lastFetch.toISOString())}</span>
          </div>
        )}

        <div className="h-4 w-px bg-border-base" />

        {/* Service status pills */}
        <div className="flex items-center gap-2">
          <StatusPill online={isLive} label="API" />
          <StatusPill online={anthropicOk} label="Anthropic" />
          <StatusPill online={geminiOk} label="Gemini" />
          <StatusPill online={ollamaOnline} label={`Ollama${ollamaModels.length > 0 ? ` (${ollamaModels.length})` : ''}`} />
        </div>

        <div className="flex-1" />

        {/* Backend mode */}
        {health && (
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            backend: {health.backend}
          </span>
        )}

        <div className="h-4 w-px bg-border-base" />

        {/* Live clock */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
          <Clock className="w-3 h-3" />
          {formatTime(now)}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchAll}
          className="p-1.5 hover:bg-border-base rounded transition-colors text-text-muted hover:text-text-primary"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden min-h-0">

        {/* ── Left: Agent Pipeline (2/3) ─────────────────────────────────── */}
        <div className="col-span-2 flex flex-col border-r border-border-base overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border-base">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">Task Queue</span>
              <span className="text-xs text-text-muted font-mono ml-1">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''} · from TASKS.md
              </span>
            </div>
            <button
              onClick={() => setShowDispatch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Send className="w-3 h-3" />
              Dispatch
            </button>
          </div>

          {/* Task feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
                <RefreshCw className="w-6 h-6 animate-spin opacity-30" />
                <p className="text-sm font-mono">Connecting to backend…</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
                <CheckCircle className="w-6 h-6 opacity-30" />
                <p className="text-sm font-mono">Queue empty — no tasks in TASKS.md</p>
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
                      <p className="text-sm text-text-primary leading-snug">{task.description}</p>
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

          {/* Agent Registry (top half) */}
          <div className="flex-1 flex flex-col border-b border-border-base overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary">Agent Registry</span>
              </div>
              <span className="text-[11px] font-mono text-text-muted">{agents.length} agents</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border-base">
              {agents.length === 0 && !loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-text-muted font-mono">
                    {isLive ? 'No agents registered' : 'Backend offline'}
                  </p>
                </div>
              ) : (
                agents.map((agent) => {
                  const ok = agent.status === 'ok'
                  return (
                    <div key={agent.name} className="px-4 py-2.5 hover:bg-surface">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', ok ? 'bg-green-500' : 'bg-red-500')} />
                          <span className="text-[11px] font-mono text-text-primary truncate">{agent.name}</span>
                        </div>
                        <span className={clsx('text-[10px] font-medium', tierColor[agent.tier] ?? 'text-text-muted')}>
                          {agent.tier}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pl-3">
                        <span>{agent.role}</span>
                        <span className={ok ? 'text-green-500' : 'text-red-500'}>{ok ? 'ok' : 'err'}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Models (bottom half) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-text-primary">Models</span>
              </div>
              <span className="text-[11px] font-mono text-text-muted">{allModels.length} available</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border-base">
              {allModels.map((model) => (
                <div key={model.name} className="px-4 py-2.5 hover:bg-surface">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-text-primary truncate max-w-[140px]">{model.name}</span>
                    <span className={clsx('text-[10px] font-medium', tierLabel[model.tier])}>
                      {model.tier}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
                    <span>{model.provider}</span>
                    <span className={model.online ? 'text-green-500' : 'text-red-500'}>
                      {model.online ? 'online' : 'offline'}
                    </span>
                  </div>
                </div>
              ))}

              {allModels.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-text-muted font-mono">
                    {loading ? 'Loading…' : 'No models detected'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Service details strip ──────────────────────────────────────────── */}
      {health && (
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-2.5 bg-surface border-t border-border-base text-[10px] font-mono text-text-muted">
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            <span className="text-text-secondary">Ollama:</span>
            <span className={ollamaOnline ? 'text-green-500' : 'text-red-500'}>{health.services.ollama.url}</span>
          </div>
          <div className="h-3 w-px bg-border-base" />
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            <span className="text-text-secondary">Backend:</span>
            <span className="text-accent">{health.backend}</span>
          </div>
          {health.services.openclaw.enabled && (
            <>
              <div className="h-3 w-px bg-border-base" />
              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary">OpenClaw:</span>
                <span className={health.services.openclaw.reachable ? 'text-green-500' : 'text-yellow-500'}>
                  {health.services.openclaw.reachable ? 'reachable' : 'unreachable'}
                </span>
                <span className="text-text-muted/50">{health.services.openclaw.url}</span>
              </div>
            </>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            <span>
              {isLive
                ? `synced ${lastFetch ? timeAgo(lastFetch.toISOString()) : ''}`
                : 'backend unreachable'}
            </span>
          </div>
        </div>
      )}

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
