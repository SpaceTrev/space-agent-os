import { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple' | 'orange'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
  size?: 'sm' | 'md'
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-green-500/15 light:bg-green-100 text-green-400 light:text-green-700 ring-1 ring-inset ring-green-500/30 light:ring-green-300',
  yellow: 'bg-yellow-500/15 light:bg-yellow-100 text-yellow-400 light:text-yellow-700 ring-1 ring-inset ring-yellow-500/30 light:ring-yellow-300',
  red: 'bg-red-500/15 light:bg-red-100 text-red-400 light:text-red-700 ring-1 ring-inset ring-red-500/30 light:ring-red-300',
  gray: 'bg-gray-500/15 light:bg-gray-100 text-gray-400 light:text-gray-700 ring-1 ring-inset ring-gray-500/30 light:ring-gray-300',
  blue: 'bg-blue-500/15 light:bg-blue-100 text-blue-400 light:text-blue-700 ring-1 ring-inset ring-blue-500/30 light:ring-blue-300',
  purple: 'bg-purple-500/15 light:bg-purple-100 text-purple-400 light:text-purple-700 ring-1 ring-inset ring-purple-500/30 light:ring-purple-300',
  orange: 'bg-orange-500/15 light:bg-orange-100 text-orange-400 light:text-orange-700 ring-1 ring-inset ring-orange-500/30 light:ring-orange-300',
}

const dotColors: Record<BadgeVariant, string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-400',
  gray: 'bg-gray-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export function Badge({
  variant = 'gray',
  dot = false,
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])}
        />
      )}
      {children}
    </span>
  )
}

// Convenience status badge for agent/task statuses
type AgentStatusVariant = 'working' | 'idle' | 'blocked' | 'in-session' | 'needs-review' | 'paused' | 'archived'
type TaskStatusVariant = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'retrying'

const agentStatusMap: Record<AgentStatusVariant, { variant: BadgeVariant; label: string }> = {
  working: { variant: 'green', label: 'Working' },
  idle: { variant: 'gray', label: 'Idle' },
  blocked: { variant: 'red', label: 'Blocked' },
  'in-session': { variant: 'blue', label: 'In Session' },
  'needs-review': { variant: 'yellow', label: 'Needs Review' },
  paused: { variant: 'orange', label: 'Paused' },
  archived: { variant: 'gray', label: 'Archived' },
}

const taskStatusMap: Record<TaskStatusVariant, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'gray', label: 'Pending' },
  queued: { variant: 'blue', label: 'Queued' },
  running: { variant: 'green', label: 'Running' },
  completed: { variant: 'green', label: 'Completed' },
  failed: { variant: 'red', label: 'Failed' },
  canceled: { variant: 'gray', label: 'Canceled' },
  retrying: { variant: 'yellow', label: 'Retrying' },
}

export function AgentStatusBadge({ status }: { status: AgentStatusVariant }) {
  const config = agentStatusMap[status] || { variant: 'gray' as BadgeVariant, label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}

export function TaskStatusBadge({ status }: { status: TaskStatusVariant }) {
  const config = taskStatusMap[status] || { variant: 'gray' as BadgeVariant, label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}
