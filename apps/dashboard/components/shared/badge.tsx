import { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple' | 'orange'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
  size?: 'sm' | 'md'
}

const variantClasses: Record<BadgeVariant, string> = {
  green:  'bg-green-500/15 text-green-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  red:    'bg-red-500/15 text-red-400',
  gray:   'bg-surface-highest text-on-surface-variant',
  blue:   'bg-blue-500/15 text-blue-400',
  purple: 'bg-purple-500/15 text-purple-400',
  orange: 'bg-orange-500/15 text-orange-400',
}

const dotColors: Record<BadgeVariant, string> = {
  green:  'bg-green-400',
  yellow: 'bg-yellow-400',
  red:    'bg-red-400',
  gray:   'bg-on-surface-variant',
  blue:   'bg-blue-400',
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
        'inline-flex items-center gap-1.5 font-medium rounded-sm',
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
  working:       { variant: 'green',  label: 'Working' },
  idle:          { variant: 'gray',   label: 'Idle' },
  blocked:       { variant: 'red',    label: 'Blocked' },
  'in-session':  { variant: 'blue',   label: 'In Session' },
  'needs-review':{ variant: 'yellow', label: 'Needs Review' },
  paused:        { variant: 'orange', label: 'Paused' },
  archived:      { variant: 'gray',   label: 'Archived' },
}

const taskStatusMap: Record<TaskStatusVariant, { variant: BadgeVariant; label: string }> = {
  pending:   { variant: 'gray',   label: 'Pending' },
  queued:    { variant: 'blue',   label: 'Queued' },
  running:   { variant: 'green',  label: 'Running' },
  completed: { variant: 'green',  label: 'Completed' },
  failed:    { variant: 'red',    label: 'Failed' },
  canceled:  { variant: 'gray',   label: 'Canceled' },
  retrying:  { variant: 'yellow', label: 'Retrying' },
}

export function AgentStatusBadge({ status }: { status: AgentStatusVariant }) {
  const config = agentStatusMap[status] || { variant: 'gray' as BadgeVariant, label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}

export function TaskStatusBadge({ status }: { status: TaskStatusVariant }) {
  const config = taskStatusMap[status] || { variant: 'gray' as BadgeVariant, label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}
