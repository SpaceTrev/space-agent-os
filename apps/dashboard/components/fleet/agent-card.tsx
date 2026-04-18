'use client'

import { clsx } from 'clsx'
import { Bot, Zap, CheckCircle, Clock } from 'lucide-react'
import { Badge } from '../shared/badge'

export type AgentDisplayStatus = 'working' | 'idle' | 'blocked' | 'in-session' | 'needs-review' | 'paused'

interface AgentCardProps {
  id: string
  name: string
  role: string
  status: AgentDisplayStatus
  currentTask?: string | null
  model: string
  tasksCompleted: number
  department?: string
  onClick?: () => void
}

const statusConfig: Record<
  AgentDisplayStatus,
  { dot: string; badge: 'green' | 'gray' | 'red' | 'blue' | 'yellow' | 'orange'; label: string }
> = {
  working: { dot: 'bg-green-400 animate-pulse', badge: 'green', label: 'Working' },
  idle: { dot: 'bg-gray-500', badge: 'gray', label: 'Idle' },
  blocked: { dot: 'bg-red-500', badge: 'red', label: 'Blocked' },
  'in-session': { dot: 'bg-blue-400 animate-pulse', badge: 'blue', label: 'In Session' },
  'needs-review': { dot: 'bg-yellow-400', badge: 'yellow', label: 'Needs Review' },
  paused: { dot: 'bg-orange-400', badge: 'orange', label: 'Paused' },
}

function modelShortName(model: string): string {
  // e.g. "anthropic:claude-3-5-sonnet-20241022" -> "claude-3.5-sonnet"
  const parts = model.split(':')
  const name = parts[parts.length - 1]
  return name.replace(/-\d{8}$/, '').slice(0, 24)
}

export function AgentCard({
  id,
  name,
  role,
  status,
  currentTask,
  model,
  tasksCompleted,
  department,
  onClick,
}: AgentCardProps) {
  const config = statusConfig[status]

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={clsx(
        'bg-[var(--surface-container)] rounded-xl p-4 flex flex-col gap-3',
        'transition-all duration-150',
        onClick && 'cursor-pointer hover:bg-[var(--surface-container-high)]'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--surface-container-highest)] flex items-center justify-center">
              <Bot className="w-5 h-5 text-brand-400" />
            </div>
            {/* Status dot */}
            <span
              className={clsx(
                'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-outline-variant',
                config.dot
              )}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--on-surface)] truncate">{name}</p>
            <p className="text-xs text-[var(--on-surface-variant)] truncate">{role}</p>
          </div>
        </div>
        <Badge variant={config.badge} size="sm" dot>
          {config.label}
        </Badge>
      </div>

      {/* Current task */}
      <div className="min-h-[32px]">
        {currentTask ? (
          <div className="flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--on-surface)] line-clamp-2">{currentTask}</p>
          </div>
        ) : (
          <p className="text-xs text-[var(--on-surface-variant)] opacity-60 italic">No active task</p>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-2 mt-auto">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-[var(--surface-container-highest)] flex items-center justify-center">
            <span className="text-[9px] text-[var(--on-surface-variant)] font-mono">AI</span>
          </div>
          <span className="text-xs text-[var(--on-surface-variant)] font-mono truncate max-w-[120px]">
            {modelShortName(model)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)]">
          <CheckCircle className="w-3.5 h-3.5 text-[var(--on-surface-variant)] opacity-60" />
          <span>{tasksCompleted} tasks</span>
        </div>
      </div>
    </div>
  )
}
