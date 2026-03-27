'use client'

import { useEffect, useState, useRef } from 'react'
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

interface DiscordMessage {
  id: string
  author: string
  content: string
  ts: string
  type: 'command' | 'message' | 'bot'
}

interface ModelStat {
  name: string
  tier: 'primary' | 'secondary' | 'local'
  provider: string
  requests: number
  avg_latency_s: number
  status: 'online' | 'offline' | 'degraded'
}

// ─── Mock data (TODO: wire to /api/ops/*) ─────────────────────────────────────

const MOCK_TASKS: PipelineTask[] = [
  {
    id: 'hb-001',
    description: 'Heartbeat tick — scanning TASKS.md for urgent items',
    model: 'llama3.1:8b',
    priority: 'NORMAL',
    status: 'done',
    elapsed_s: 0.3,
    started_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'smoke-001',
    description: 'Worker smoke test: Print hello world in Python in one line',
    model: 'qwen3-coder:30b',
    priority: 'NORMAL',
    status: 'done',
    elapsed_s: 12.5,
    started_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'orch-001',
    description: 'Orchestrator smoke test — system readiness check',
    model: 'llama3.1:8b',
    priority: 'NORMAL',
    status: 'done',
    elapsed_s: 3.1,
    started_at: new Date(Date.now() - 600000).toISOString(),
  },
]

const MOCK_DISCORD_MESSAGES: DiscordMessage[] = [
  {
    id: '1',
    author: 'Space-Claw',
    content: '🤖 **Space-Claw online.** Type `/ask` or mention me to start.',
    ts: new Date(Date.now() - 900000).toISOString(),
    type: 'bot',
  },
]

const MOCK_MODELS: ModelStat[] = [
  {
    name: 'claude-sonnet-4-6',
    tier: 'primary',
    provider: 'OpenClaw',
    requests: 0,
    avg_latency_s: 0,
    status: 'online',
  },
  {
    name: 'gemini-2.0-flash',
    tier: 'secondary',
    provider: 'Google',
    requests: 0,
    avg_latency_s: 0,
    status: 'online',
  },
  {
    name: 'llama3.1:8b',
    tier: 'local',
    provider: 'Ollama',
    requests: 2,
    avg_latency_s: 1.8,
    status: 'online',
  },
  {
    name: 'qwen3-coder:30b',
    tier: 'local',
    provider: 'Ollama',
    requests: 1,
    avg_latency_s: 12.5,
    status: 'online',
  },
]

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
      return <RefreshCw className="w-3.5 h-3.5 text-brand-400 animate-spin" />
    case 'done':
      return <CheckCircle className="w-3.5 h-3.5 text-green-400" />
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />
    case 'queued':
      return <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
    default:
      return <Circle className="w-3.5 h-3.5 text-gray-500" />
  }
}

const priorityBadge: Record<string, string> = {
  URGENT: 'text-red-400 bg-red-500/10',
  HIGH: 'text-orange-400 bg-orange-500/10',
  NORMAL: 'text-gray-400 bg-gray-700',
  LOW: 'text-gray-600 bg-gray-800',
}

const tierLabel: Record<string, string> = {
  primary: 'text-brand-400',
  secondary: 'text-purple-400',
  local: 'text-green-400',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ online, label }: { online: boolean; label: string }) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border',
      online
        ? 'text-green-400 bg-green-500/10 border-green-500/20'
        : 'text-gray-500 bg-gray-800 border-gray-700'
    )}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full',
        online ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
      )} />
      {label}
    </div>
  )
}

function DispatchModal({ onClose, onSend }: { onClose: () => void; onSend: (task: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Send className="w-4 h-4 text-brand-400" />
          Dispatch Task
        </h3>
        <p className="text-xs text-gray-500 mb-4">Sent to the worker queue via CentralBrain</p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Describe the task... e.g. 'Refactor the orchestrator to use async generators'"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none font-mono"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
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
  const [tasks, setTasks] = useState<PipelineTask[]>(MOCK_TASKS)
  const [discordMessages] = useState<DiscordMessage[]>(MOCK_DISCORD_MESSAGES)
  const [showDispatch, setShowDispatch] = useState(false)
  const [lastHeartbeat] = useState(new Date(Date.now() - 120000))
  const [botConnected] = useState(false) // TODO: wire to /api/ops/discord-status
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

  function handleDispatch(description: string) {
    const newTask: PipelineTask = {
      id: `task-${Date.now()}`,
      description,
      model: 'claude-sonnet-4-6',
      priority: 'NORMAL',
      status: 'queued',
      elapsed_s: null,
      started_at: new Date().toISOString(),
    }
    setTasks((prev) => [newTask, ...prev])
    // TODO: POST to /api/ops/dispatch
  }

  const totalRequests = MOCK_MODELS.reduce((s, m) => s + m.requests, 0)

  return (
    <div className="h-full flex flex-col bg-gray-950 overflow-hidden">

      {/* ── System Status Bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 mr-2">
          <Terminal className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-bold text-white font-mono">MISSION CONTROL</span>
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Heartbeat */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <Activity className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
          <span className="text-gray-400">HB</span>
          <span className="text-brand-400">{timeAgo(lastHeartbeat.toISOString())}</span>
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Model pills */}
        <div className="flex items-center gap-2">
          <StatusPill online label="Claude Sonnet" />
          <StatusPill online label="Gemini Flash" />
          <StatusPill online label="Ollama" />
        </div>

        <div className="flex-1" />

        {/* Live clock */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500">
          <Clock className="w-3 h-3" />
          {formatTime(now)}
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden min-h-0">

        {/* ── Left: Agent Pipeline (2/3) ─────────────────────────────────── */}
        <div className="col-span-2 flex flex-col border-r border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-white">Agent Pipeline</span>
              <span className="text-xs text-gray-600 font-mono ml-1">{tasks.length} tasks</span>
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
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
                <RefreshCw className="w-6 h-6 animate-spin opacity-30" />
                <p className="text-sm">Waiting for tasks...</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-900/60 transition-colors"
                  >
                    <div className="mt-0.5 flex-shrink-0">{statusIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate leading-snug">{task.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-mono text-gray-500">{task.id}</span>
                        <span className="text-[10px] font-mono text-brand-500/80">{task.model}</span>
                        {task.elapsed_s !== null && (
                          <span className="text-[10px] font-mono text-gray-600">{task.elapsed_s}s</span>
                        )}
                        <span className="text-[10px] text-gray-600">{timeAgo(task.started_at)}</span>
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

          {/* Discord Activity (top half) */}
          <div className="flex-1 flex flex-col border-b border-gray-800 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">Discord</span>
              </div>
              <div className={clsx(
                'flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border',
                botConnected
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
              )}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', botConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400')} />
                {botConnected ? 'ONLINE' : 'INVITE BOT'}
              </div>
            </div>

            {/* Bot invite CTA if not connected */}
            {!botConnected && (
              <div className="px-4 py-3 bg-yellow-500/5 border-b border-yellow-500/10">
                <p className="text-[11px] text-yellow-400/80 leading-snug">
                  Bot not in server yet. Add it:
                </p>
                <a
                  href="https://discord.com/oauth2/authorize?client_id=1484792458981412894&scope=bot+applications.commands&permissions=277025770560"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 mt-1 font-mono underline underline-offset-2"
                >
                  discord.com/oauth2/authorize
                  <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Channel info */}
            <div className="px-4 py-2 border-b border-gray-800/50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500 font-mono">#space-claw</span>
                <span className="text-gray-600 font-mono">id: 1484793801531719803</span>
              </div>
            </div>

            {/* Commands ref */}
            <div className="px-4 py-2 border-b border-gray-800/50 flex flex-wrap gap-1.5">
              {['/ask', '/status', '/tasks', '/swarm'].map((cmd) => (
                <span key={cmd} className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700">{cmd}</span>
              ))}
            </div>

            {/* Message feed */}
            <div className="flex-1 overflow-y-auto">
              {discordMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-600">No messages yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/40">
                  {discordMessages.map((msg) => (
                    <div key={msg.id} className="px-4 py-2.5 hover:bg-gray-900/40">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={clsx(
                          'text-[11px] font-semibold',
                          msg.type === 'bot' ? 'text-brand-400' : 'text-gray-300'
                        )}>
                          {msg.author}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">{timeAgo(msg.ts)}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Model Usage (bottom half) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Models</span>
              </div>
              <span className="text-[11px] font-mono text-gray-600">{totalRequests} req</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40">
              {MOCK_MODELS.map((model) => (
                <div key={model.name} className="px-4 py-2.5 hover:bg-gray-900/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-gray-200 truncate max-w-[140px]">{model.name}</span>
                    <span className={clsx('text-[10px] font-medium', tierLabel[model.tier])}>
                      {model.tier}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-600 font-mono">
                    <span>{model.provider}</span>
                    <span>{model.requests}r · {model.avg_latency_s > 0 ? `${model.avg_latency_s}s avg` : '—'}</span>
                    <span className={clsx(
                      model.status === 'online' ? 'text-green-500' : 'text-red-500'
                    )}>
                      {model.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions strip ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 bg-gray-900 border-t border-gray-800">
        <span className="text-[11px] font-mono text-gray-600 mr-1 uppercase tracking-wider">Quick actions</span>
        {[
          { label: 'Start Heartbeat', icon: Activity, color: 'text-brand-400' },
          { label: 'Orchestrator Smoke', icon: Bot, color: 'text-green-400' },
          { label: 'View TASKS.md', icon: GitBranch, color: 'text-yellow-400' },
          { label: 'Git Status', icon: GitBranch, color: 'text-purple-400' },
          { label: 'Discord Status', icon: MessageSquare, color: 'text-indigo-400' },
        ].map(({ label, icon: Icon, color }) => (
          <button
            key={label}
            onClick={() => {
              // TODO: POST to /api/ops/[action]
              console.log('action:', label)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-xs text-gray-400 hover:text-white rounded-lg transition-all font-mono"
          >
            <Icon className={clsx('w-3 h-3', color)} />
            {label}
          </button>
        ))}
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
