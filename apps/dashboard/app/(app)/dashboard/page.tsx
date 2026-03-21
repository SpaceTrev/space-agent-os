'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Bot, Zap, DollarSign, Activity, TrendingUp, Plus, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface WorkspaceStats {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  agentCount: number
  activeCount: number
  currentSprint: string | null
  costThisMonth: number
  tasksThisMonth: number
}

interface RecentTask {
  id: string
  title: string
  status: string
  cost_usd: number
  created_at: string
  workspace_name: string
  agent_name: string | null
}

const statusColors: Record<string, string> = {
  completed: 'text-green-400',
  running: 'text-blue-400',
  queued: 'text-yellow-400',
  failed: 'text-red-400',
  pending: 'text-gray-400',
  canceled: 'text-gray-500',
  retrying: 'text-orange-400',
}

const statusDots: Record<string, string> = {
  completed: 'bg-green-400',
  running: 'bg-blue-400 animate-pulse',
  queued: 'bg-yellow-400',
  failed: 'bg-red-400',
  pending: 'bg-gray-400',
  canceled: 'bg-gray-500',
  retrying: 'bg-orange-400 animate-pulse',
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function DashboardPage() {
  const { workspaces: authWorkspaces } = useAuth()
  const [wsStats, setWsStats] = useState<WorkspaceStats[]>([])
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authWorkspaces.length) {
      setLoading(false)
      return
    }

    async function loadStats() {
      try {
        // For each workspace, fetch agent counts and recent tasks
        const statsPromises = authWorkspaces.map(async (ws) => {
          const [agentsRes, tasksRes, sprintsRes] = await Promise.all([
            fetch(`/api/agents?workspace_id=${ws.id}`),
            fetch(`/api/tasks?workspace_id=${ws.id}&per_page=5`),
            fetch(`/api/sprints?workspace_id=${ws.id}`),
          ])

          const agents = agentsRes.ok ? (await agentsRes.json()).agents ?? [] : []
          const tasks = tasksRes.ok ? (await tasksRes.json()).tasks ?? [] : []
          const sprints = sprintsRes.ok ? (await sprintsRes.json()).sprints ?? [] : []

          const activeAgents = agents.filter((a: { status: string }) => a.status === 'running')
          const activeSprint = sprints.find((s: { status: string }) => s.status === 'active')
          const totalCost = tasks.reduce((sum: number, t: { cost_usd: number }) => sum + (Number(t.cost_usd) || 0), 0)

          return {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            description: ws.description,
            status: ws.status,
            agentCount: agents.length,
            activeCount: activeAgents.length,
            currentSprint: activeSprint?.name ?? null,
            costThisMonth: totalCost,
            tasksThisMonth: tasks.length,
            recentTasks: tasks.slice(0, 3).map((t: { id: string; title: string; status: string; cost_usd: number; created_at: string; agent?: { name: string } | null }) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              cost_usd: Number(t.cost_usd) || 0,
              created_at: t.created_at,
              workspace_name: ws.name,
              agent_name: t.agent?.name ?? null,
            })),
          }
        })

        const allStats = await Promise.all(statsPromises)
        setWsStats(allStats)

        // Merge and sort recent tasks
        const allTasks = allStats
          .flatMap((s) => (s as unknown as { recentTasks: RecentTask[] }).recentTasks)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8)
        setRecentTasks(allTasks)
      } catch (err) {
        console.error('Failed to load dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [authWorkspaces])

  const totalCost = wsStats.reduce((sum, ws) => sum + ws.costThisMonth, 0)
  const totalAgents = wsStats.reduce((sum, ws) => sum + ws.agentCount, 0)
  const totalActive = wsStats.reduce((sum, ws) => sum + ws.activeCount, 0)
  const totalTasks = wsStats.reduce((sum, ws) => sum + ws.tasksThisMonth, 0)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">All workspaces overview</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </Link>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Agents', value: totalAgents, icon: Bot, color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { label: 'Active Now', value: totalActive, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Tasks This Month', value: totalTasks.toLocaleString(), icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Cost This Month', value: `$${totalCost.toFixed(2)}`, icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
                <Icon className={clsx('w-4 h-4', stat.color)} />
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Workspace grid */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Workspaces</h2>
          <span className="text-xs text-gray-600">{wsStats.length} total</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {wsStats.map((ws) => (
            <Link
              key={ws.id}
              href={`/${ws.slug}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-900/80 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-400 group-hover:border-gray-600 transition-colors">
                    {ws.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{ws.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[160px]">{ws.description}</p>
                  </div>
                </div>
                <div className={clsx(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium',
                  ws.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'
                )}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', ws.status === 'active' ? 'bg-green-400' : 'bg-gray-500')} />
                  {ws.status.charAt(0).toUpperCase() + ws.status.slice(1)}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">Agents</p>
                  <p className="text-sm font-semibold text-white">
                    {ws.activeCount} <span className="text-gray-500 font-normal">/ {ws.agentCount} active</span>
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">Cost this month</p>
                  <p className="text-sm font-semibold text-yellow-400 font-mono">${ws.costThisMonth.toFixed(2)}</p>
                </div>
              </div>

              {/* Sprint */}
              {ws.currentSprint ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <TrendingUp className="w-3.5 h-3.5 text-brand-400" />
                  <span className="truncate">{ws.currentSprint}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-700">No active sprint</p>
              )}

              <div className="flex items-center justify-end mt-3">
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            </Link>
          ))}

          {/* Add workspace card */}
          <Link
            href="/dashboard"
            className="bg-gray-900 border border-dashed border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors flex flex-col items-center justify-center gap-3 min-h-[180px] text-gray-600 hover:text-gray-400"
          >
            <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium">Add workspace</p>
          </Link>
        </div>
      </div>

      {/* Activity feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Activity</h2>
          <span className="text-xs text-gray-600">All workspaces</span>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {recentTasks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-500">No tasks yet. Dispatch your first task to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {recentTasks.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/50 transition-colors">
                  <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', statusDots[item.status] ?? 'bg-gray-500')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.workspace_name} {item.agent_name ? `· ${item.agent_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    <span className={clsx('font-medium', statusColors[item.status] ?? 'text-gray-400')}>
                      {item.status}
                    </span>
                    <span className="text-gray-600 font-mono">${item.cost_usd.toFixed(3)}</span>
                    <span className="text-gray-600">{timeAgo(item.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
