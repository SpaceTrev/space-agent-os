import { clsx } from 'clsx'
import { Zap, Brain, Clock, DollarSign } from 'lucide-react'

interface UsageMeterItem {
  label: string
  used: number
  total: number | null
  unit: string
  icon: React.ElementType
  color: string
}

interface UsageMeterProps {
  tasksUsed: number
  tasksTotal: number | null
  tokensUsed: number
  tokensTotal: number | null
  costUsd: number
  costBudget: number | null
  computeHoursUsed: number
  computeHoursTotal: number | null
}

function MeterBar({
  used,
  total,
  color,
}: {
  used: number
  total: number | null
  color: string
}) {
  const pct = total != null && total > 0 ? Math.min(100, Math.round((used / total) * 100)) : null
  const isWarning = pct != null && pct >= 80
  const isDanger = pct != null && pct >= 95

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        {pct != null ? (
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : color
            )}
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className={clsx('h-full rounded-full', color)} style={{ width: '40%' }} />
        )}
      </div>
      {pct != null && (
        <div className="flex items-center justify-between text-[10px]">
          <span className={clsx(isDanger ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-600')}>
            {pct}% used
          </span>
          {isDanger && <span className="text-red-400 font-medium">Near limit!</span>}
          {isWarning && !isDanger && <span className="text-yellow-400">Approaching limit</span>}
        </div>
      )}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function UsageMeter({
  tasksUsed,
  tasksTotal,
  tokensUsed,
  tokensTotal,
  costUsd,
  costBudget,
  computeHoursUsed,
  computeHoursTotal,
}: UsageMeterProps) {
  const items: UsageMeterItem[] = [
    {
      label: 'Tasks',
      used: tasksUsed,
      total: tasksTotal,
      unit: 'tasks',
      icon: Zap,
      color: 'bg-brand-500',
    },
    {
      label: 'Tokens',
      used: tokensUsed,
      total: tokensTotal,
      unit: 'tokens',
      icon: Brain,
      color: 'bg-purple-500',
    },
    {
      label: 'Compute',
      used: computeHoursUsed,
      total: computeHoursTotal,
      unit: 'hrs',
      icon: Clock,
      color: 'bg-green-500',
    },
    {
      label: 'Cost',
      used: costUsd,
      total: costBudget,
      unit: 'USD',
      icon: DollarSign,
      color: 'bg-yellow-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon
        const displayUsed =
          item.unit === 'USD'
            ? `$${item.used.toFixed(2)}`
            : formatNumber(item.used)
        const displayTotal =
          item.total == null
            ? 'Unlimited'
            : item.unit === 'USD'
            ? `$${item.total.toFixed(2)}`
            : formatNumber(item.total)

        return (
          <div key={item.label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={clsx('w-6 h-6 rounded-md flex items-center justify-center', item.color.replace('bg-', 'bg-') + '/20')}>
                <Icon className={clsx('w-3.5 h-3.5', item.color.replace('bg-', 'text-'))} />
              </div>
              <span className="text-xs font-medium text-gray-400">{item.label}</span>
            </div>
            <div className="mt-2">
              <span className="text-xl font-bold text-white">{displayUsed}</span>
              {item.total != null && (
                <span className="text-xs text-gray-500 ml-1">/ {displayTotal}</span>
              )}
              {item.total == null && (
                <span className="text-xs text-gray-500 ml-1">this month</span>
              )}
            </div>
            <MeterBar used={item.used} total={item.total} color={item.color} />
          </div>
        )
      })}
    </div>
  )
}
