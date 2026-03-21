'use client'

import { clsx } from 'clsx'
import { Clock, DollarSign, User, Zap } from 'lucide-react'
import { TaskStatusBadge } from '../shared/badge'
import type { TaskStatus, TaskPriority } from '../../lib/types'
import { formatDistanceToNow } from 'date-fns'

interface TaskCardProps {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  agentName?: string | null
  createdAt: string
  costUsd?: number
  onClick?: () => void
}

const priorityConfig: Record<TaskPriority, { color: string; label: string }> = {
  low: { color: 'text-gray-500', label: 'Low' },
  normal: { color: 'text-blue-400', label: 'Normal' },
  high: { color: 'text-orange-400', label: 'High' },
  critical: { color: 'text-red-400', label: 'Critical' },
}

export function TaskCard({
  id,
  title,
  description,
  status,
  priority,
  agentName,
  createdAt,
  costUsd,
  onClick,
}: TaskCardProps) {
  const pConfig = priorityConfig[priority]
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true })

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={clsx(
        'bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3',
        'transition-all duration-150',
        onClick && 'cursor-pointer hover:border-gray-600 hover:bg-gray-750 hover:shadow-md'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-2">{title}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{description}</p>
          )}
        </div>
        <TaskStatusBadge status={status} />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {agentName && (
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{agentName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
        {costUsd != null && costUsd > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <DollarSign className="w-3 h-3" />
            <span className="font-mono">${costUsd.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Priority indicator */}
      <div className="flex items-center gap-1.5">
        <Zap className={clsx('w-3 h-3', pConfig.color)} />
        <span className={clsx('text-xs', pConfig.color)}>{pConfig.label} priority</span>
      </div>
    </div>
  )
}
