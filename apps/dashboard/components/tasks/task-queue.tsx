'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { TaskCard } from './task-card'
import type { TaskStatus, TaskPriority } from '../../lib/types'

interface TaskItem {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  agentName?: string | null
  createdAt: string
  costUsd?: number
}

const FILTER_TABS: { label: string; value: TaskStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Queued', value: 'queued' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Pending', value: 'pending' },
]

interface TaskQueueProps {
  tasks: TaskItem[]
  onTaskClick?: (taskId: string) => void
  loading?: boolean
}

export function TaskQueue({ tasks, onTaskClick, loading }: TaskQueueProps) {
  const [activeFilter, setActiveFilter] = useState<TaskStatus | 'all'>('all')

  const filtered =
    activeFilter === 'all' ? tasks : tasks.filter((t) => t.status === activeFilter)

  const countForStatus = (status: TaskStatus | 'all') =>
    status === 'all' ? tasks.length : tasks.filter((t) => t.status === status).length

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const count = countForStatus(tab.value)
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                activeFilter === tab.value
                  ? 'bg-surface-highest text-white'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={clsx(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold px-1',
                    activeFilter === tab.value
                      ? 'bg-on-surface-variant/40 text-on-surface'
                      : 'bg-surface-high text-on-surface-variant'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-surface-high rounded-xl animate-pulse border border-outline-variant" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-on-surface-variant">No tasks found</p>
          <p className="text-xs text-on-surface-variant mt-1">
            {activeFilter !== 'all' ? `No ${activeFilter} tasks` : 'Dispatch a task to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
