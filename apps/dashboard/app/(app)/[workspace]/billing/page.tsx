'use client'

import { useState, useEffect, use } from 'react'
import { useAuth } from '@/lib/auth-context'
import { UsageMeter } from '../../../../components/billing/usage-meter'
import { CostBreakdown } from '../../../../components/billing/cost-breakdown'
import { CreditCard, Download, ExternalLink } from 'lucide-react'

interface MonthUsage {
  month: string
  tasks_completed: number
  tokens_used: number
  compute_hours: number
  cost_usd: number
}

interface UsageSummary {
  total_cost_usd: number
  total_tokens: number
  total_compute_seconds: number
}

interface UsageResponse {
  summary: UsageSummary
  monthly_history: MonthUsage[]
  is_seed_data: boolean
}

interface Subscription {
  plan: string
  plan_name: string
  status: string
  current_period_end: string
  monthly_task_limit: number
  monthly_token_limit: number | null
  stripe_customer_id: string | null
  features: string[]
  billing_cycle: string
}

const departmentMargins = [
  { department: 'Engineering Swarm', revenue: 6500, tokenCost: 42.50, computeCost: 28.00, tasks: 840, marginRaw: 6429.50, marginPct: 98.9 },
  { department: 'Support Swarm', revenue: 1200, tokenCost: 12.80, computeCost: 15.00, tasks: 320, marginRaw: 1172.20, marginPct: 97.6 },
  { department: 'Marketing Swarm', revenue: 850, tokenCost: 2.90, computeCost: 5.00, tasks: 80, marginRaw: 842.10, marginPct: 99.0 },
]

function formatMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatNextBilling(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function BillingPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()

  const [usageData, setUsageData] = useState<UsageResponse | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return

    async function fetchBillingData() {
      try {
        const [usageRes, subRes] = await Promise.all([
          fetch(`/api/billing/usage?workspace_id=${ws!.id}`),
          fetch(`/api/billing/subscription?workspace_id=${ws!.id}`),
        ])

        if (!usageRes.ok) throw new Error('Failed to load usage data')
        if (!subRes.ok) throw new Error('Failed to load subscription data')

        const [usageJson, subJson] = await Promise.all([usageRes.json(), subRes.json()])
        setUsageData(usageJson)
        setSubscription(subJson.subscription)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data')
      } finally {
        setLoading(false)
      }
    }

    fetchBillingData()
  }, [ws])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="h-4 bg-gray-800 rounded w-32" />
          <div className="h-24 bg-gray-900 border border-gray-800 rounded-xl mt-8" />
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      </div>
    )
  }

  const history: MonthUsage[] = usageData?.monthly_history?.length ? usageData.monthly_history : []

  const currentMonth: MonthUsage = history[0] ?? {
    month: new Date().toISOString().slice(0, 7),
    tasks_completed: 0,
    tokens_used: usageData?.summary.total_tokens ?? 0,
    compute_hours: (usageData?.summary.total_compute_seconds ?? 0) / 3600,
    cost_usd: usageData?.summary.total_cost_usd ?? 0,
  }

  const planName = subscription?.plan_name ?? 'Pro'
  const taskLimit = subscription?.monthly_task_limit ?? 2000
  const tokenLimit = subscription?.monthly_token_limit ?? null
  const nextBilling = subscription?.current_period_end
    ? formatNextBilling(subscription.current_period_end)
    : 'April 1, 2026'
  const currentMonthLabel = history[0]?.month
    ? formatMonth(history[0].month)
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const aiCost = 58.2
  const margin = currentMonth.cost_usd - aiCost

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing &amp; Usage</h1>
          <p className="text-sm text-gray-500 mt-0.5">{currentMonthLabel} billing period</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Download invoice
          </button>
          <a
            href="https://billing.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Manage billing
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Current plan callout */}
      <div className="bg-brand-600/10 border border-brand-500/20 rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{planName} Plan</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {taskLimit.toLocaleString()} tasks/mo &middot; Next billing: {nextBilling}
          </p>
        </div>
        <a href="/pricing" className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
          Upgrade plan <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Usage meters */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">This Month&apos;s Usage</h2>
        <UsageMeter
          tasksUsed={currentMonth.tasks_completed}
          tasksTotal={taskLimit}
          tokensUsed={currentMonth.tokens_used}
          tokensTotal={tokenLimit}
          costUsd={currentMonth.cost_usd}
          costBudget={200}
          computeHoursUsed={currentMonth.compute_hours}
          computeHoursTotal={10}
        />
      </div>

      {/* Cost breakdown */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Cost Breakdown</h2>
        <CostBreakdown
          baseSubscription={99}
          extraTasks={0}
          extraTasksCount={0}
          compute={11.4}
          computeHours={currentMonth.compute_hours}
          totalInvoiced={currentMonth.cost_usd}
          yourCost={aiCost}
          yourMargin={margin}
          planName={planName}
          billingPeriod={currentMonthLabel}
        />
      </div>

      {/* Margin by department */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Margin by Department ({currentMonthLabel})</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_100px_100px_120px_100px] text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 border-b border-gray-800">
            <span>Department</span>
            <span className="text-right">Tasks</span>
            <span className="text-right">Token Cost</span>
            <span className="text-right">Compute Cost</span>
            <span className="text-right">Value/Revenue</span>
            <span className="text-right">Margin</span>
          </div>
          <div className="divide-y divide-gray-800/50">
            {departmentMargins.map((dept) => (
              <div key={dept.department} className="grid grid-cols-[1fr_80px_100px_100px_120px_100px] items-center px-5 py-3.5 hover:bg-gray-800/40 transition-colors">
                <span className="text-sm font-medium text-gray-200">{dept.department}</span>
                <span className="text-xs text-gray-400 text-right">{dept.tasks}</span>
                <span className="text-xs text-gray-400 text-right">${dept.tokenCost.toFixed(2)}</span>
                <span className="text-xs text-gray-400 text-right">${dept.computeCost.toFixed(2)}</span>
                <span className="text-sm text-white font-mono text-right">${dept.revenue.toLocaleString()}</span>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-mono text-green-400">${dept.marginRaw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-green-500/70">{dept.marginPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Billing history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Billing History</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_80px_100px] text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 border-b border-gray-800">
            <span>Period</span>
            <span>Tasks</span>
            <span>Tokens</span>
            <span>Compute</span>
            <span className="text-right">Total</span>
          </div>
          {history.map((m, i) => (
            <div
              key={m.month}
              className="grid grid-cols-[1fr_80px_80px_80px_100px] items-center px-5 py-3.5 border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200">{formatMonth(m.month)}</span>
                {i === 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/10 text-brand-400 rounded font-medium">Current</span>
                )}
              </div>
              <span className="text-xs text-gray-400">{m.tasks_completed.toLocaleString()}</span>
              <span className="text-xs text-gray-400">
                {m.tokens_used >= 1_000_000 ? `${(m.tokens_used / 1_000_000).toFixed(1)}M` : `${(m.tokens_used / 1000).toFixed(0)}K`}
              </span>
              <span className="text-xs text-gray-400">{m.compute_hours.toFixed(1)}h</span>
              <span className="text-sm font-mono text-white text-right">${m.cost_usd.toFixed(2)}</span>
            </div>
          ))}
          {history.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-gray-600">No billing history yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
