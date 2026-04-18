import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface CostLineItem {
  label: string
  description?: string
  amount: number
  type: 'base' | 'usage' | 'compute' | 'discount' | 'total' | 'your-cost' | 'margin'
}

interface CostBreakdownProps {
  baseSubscription: number
  extraTasks: number
  extraTasksCount?: number
  compute: number
  computeHours?: number
  totalInvoiced: number
  yourCost: number
  yourMargin: number
  planName?: string
  billingPeriod?: string
}

export function CostBreakdown({
  baseSubscription,
  extraTasks,
  extraTasksCount,
  compute,
  computeHours,
  totalInvoiced,
  yourCost,
  yourMargin,
  planName = 'Pro',
  billingPeriod = 'March 2026',
}: CostBreakdownProps) {
  const items: CostLineItem[] = [
    {
      label: `${planName} Plan`,
      description: 'Base subscription',
      amount: baseSubscription,
      type: 'base',
    },
    {
      label: 'Extra Tasks',
      description: extraTasksCount != null ? `${extraTasksCount.toLocaleString()} tasks over limit` : 'Additional task usage',
      amount: extraTasks,
      type: 'usage',
    },
    {
      label: 'Compute',
      description: computeHours != null ? `${computeHours.toFixed(1)} compute hours` : 'Compute usage',
      amount: compute,
      type: 'compute',
    },
  ]

  const marginPct = yourMargin > 0 ? ((yourMargin / yourCost) * 100).toFixed(1) : '0'

  return (
    <div className="bg-surface-high border border-outline-variant rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline-variant">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Cost Breakdown</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{billingPeriod}</p>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="divide-y divide-gray-700/50">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm text-on-surface">{item.label}</p>
              {item.description && (
                <p className="text-xs text-on-surface-variant mt-0.5">{item.description}</p>
              )}
            </div>
            <span className={clsx('text-sm font-mono font-medium', item.amount === 0 ? 'text-on-surface-variant' : 'text-on-surface')}>
              {item.amount === 0 ? '—' : `$${item.amount.toFixed(2)}`}
            </span>
          </div>
        ))}

        {/* Total invoiced */}
        <div className="flex items-center justify-between px-5 py-4 bg-surface-base/50">
          <p className="text-sm font-semibold text-white">Total Invoiced</p>
          <span className="text-base font-bold font-mono text-white">${totalInvoiced.toFixed(2)}</span>
        </div>

        {/* Your cost (what you actually pay AI providers) */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm text-on-surface">Your AI Cost</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Actual tokens billed by providers</p>
          </div>
          <span className="text-sm font-mono font-medium text-orange-400">${yourCost.toFixed(2)}</span>
        </div>

        {/* Margin */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm text-on-surface">Your Margin</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Revenue minus AI costs</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx('text-sm font-mono font-medium', yourMargin >= 0 ? 'text-green-400' : 'text-red-400')}>
              ${yourMargin.toFixed(2)}
            </span>
            <div className={clsx(
              'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
              yourMargin > 0 ? 'bg-green-500/10 text-green-400' : yourMargin < 0 ? 'bg-red-500/10 text-red-400' : 'bg-surface-highest text-on-surface-variant'
            )}>
              {yourMargin > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : yourMargin < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {marginPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
