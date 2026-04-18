'use client'

import { clsx } from 'clsx'
import { Calendar, CheckCircle2, XCircle, Clock, BarChart3, TrendingUp, DollarSign } from 'lucide-react'
import { Badge } from '../shared/badge'
import { TaskStatusBadge } from '../shared/badge'
import type { SprintStatus, TaskStatus, TaskPriority } from '../../lib/types'
import { formatDistanceToNow, format } from 'date-fns'

interface SprintTask {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  agentName?: string | null
  costUsd?: number
}

interface SprintBoardProps {
  id: string
  name: string
  description?: string | null
  status: SprintStatus
  goal?: string | null
  startsAt?: string | null
  endsAt?: string | null
  completedAt?: string | null
  tasks?: SprintTask[]
  stats?: {
    totalTasks: number
    completedTasks: number
    failedTasks: number
    inProgressTasks: number
    totalTokensUsed: number
    totalCostUsd: number
    avgTaskDurationSeconds: number
  }
}

const sprintStatusMap: Record<SprintStatus, { variant: 'green' | 'blue' | 'yellow' | 'gray' | 'red'; label: string }> = {
  planning: { variant: 'gray', label: 'Planning' },
  active: { variant: 'green', label: 'Active' },
  paused: { variant: 'yellow', label: 'Paused' },
  completed: { variant: 'blue', label: 'Completed' },
  canceled: { variant: 'red', label: 'Canceled' },
}

export function SprintBoard({
  id,
  name,
  description,
  status,
  goal,
  startsAt,
  endsAt,
  tasks = [],
  stats,
}: SprintBoardProps) {
  const config = sprintStatusMap[status]
  const completedCount = stats?.completedTasks ?? tasks.filter((t) => t.status === 'completed').length
  const totalCount = stats?.totalTasks ?? tasks.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="bg-surface-high border border-outline-variant rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline-variant">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-white truncate">{name}</h2>
              <Badge variant={config.variant} dot size="sm">{config.label}</Badge>
            </div>
            {description && <p className="text-sm text-on-surface-variant">{description}</p>}
            {goal && (
              <p className="text-xs text-on-surface-variant mt-1">
                <span className="font-medium text-on-surface-variant">Goal: </span>{goal}
              </p>
            )}
          </div>
          {/* Dates */}
          <div className="flex flex-col items-end gap-1 text-xs text-on-surface-variant flex-shrink-0">
            {startsAt && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Started {format(new Date(startsAt), 'MMM d')}</span>
              </div>
            )}
            {endsAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Due {formatDistanceToNow(new Date(endsAt), { addSuffix: true })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-on-surface-variant">Progress</span>
              <span className="text-xs font-medium text-on-surface">{progress}% — {completedCount}/{totalCount} tasks</span>
            </div>
            <div className="h-1.5 bg-surface-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-700 border-b border-outline-variant">
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              Completed
            </div>
            <p className="text-lg font-semibold text-white">{stats.completedTasks}</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              Failed
            </div>
            <p className="text-lg font-semibold text-white">{stats.failedTasks}</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              Tokens Used
            </div>
            <p className="text-lg font-semibold text-white">
              {stats.totalTokensUsed >= 1_000_000
                ? `${(stats.totalTokensUsed / 1_000_000).toFixed(1)}M`
                : stats.totalTokensUsed >= 1000
                ? `${(stats.totalTokensUsed / 1000).toFixed(0)}K`
                : stats.totalTokensUsed.toString()}
            </p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
              Total Cost
            </div>
            <p className="text-lg font-semibold text-white">${stats.totalCostUsd.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="divide-y divide-gray-700/60">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-on-surface-variant">
            No tasks in this sprint
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-base transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{task.title}</p>
                {task.agentName && (
                  <p className="text-xs text-on-surface-variant mt-0.5">{task.agentName}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {task.costUsd != null && task.costUsd > 0 && (
                  <span className="text-xs text-on-surface-variant font-mono">${task.costUsd.toFixed(4)}</span>
                )}
                <TaskStatusBadge status={task.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
