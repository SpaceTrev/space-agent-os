'use client'

import { useEffect, useState, use } from 'react'
import { FleetGrid } from '../../../components/fleet/fleet-grid'
import { UsageMeter } from '../../../components/billing/usage-meter'
import { Server, Cpu, Activity, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import type { AgentDisplayStatus } from '../../../components/fleet/agent-card'

interface AgentRow {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  model: string
  total_tasks_completed: number
  current_task_id: string | null
}

interface ServerRow {
  id: string
  name: string
  provider: string
  status: string
  cpu: number
  memory_mb: number
  cost_per_hour_usd: number
  region: string | null
}

const statusDotColor: Record<string, string> = {
  running: 'bg-green-400 animate-pulse',
  stopped: 'bg-gray-500',
  provisioning: 'bg-yellow-400 animate-pulse',
  stopping: 'bg-yellow-400',
  error: 'bg-red-400',
}

function agentStatusToDisplay(status: string): AgentDisplayStatus {
  const map: Record<string, AgentDisplayStatus> = {
    idle: 'idle',
    running: 'working',
    paused: 'idle',
    error: 'needs-review',
    archived: 'idle',
  }
  return map[status] ?? 'idle'
}

export default function WorkspacePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [servers, setServers] = useState<ServerRow[]>([])
  const [taskCount, setTaskCount] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [loading, setLoading] = useState(true)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return

    async function load() {
      try {
        const [agentsRes, serversRes, tasksRes] = await Promise.all([
          fetch(`/api/agents?workspace_id=${ws!.id}`),
          fetch(`/api/compute?workspace_id=${ws!.id}`),
          fetch(`/api/tasks?workspace_id=${ws!.id}&per_page=100`),
        ])

        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(data.agents ?? [])
        }
        if (serversRes.ok) {
          const data = await serversRes.json()
          setServers(data.servers ?? [])
        }
        if (tasksRes.ok) {
          const data = await tasksRes.json()
          const tasks = data.tasks ?? []
          setTaskCount(tasks.length)
          setTotalCost(tasks.reduce((sum: number, t: { cost_usd: number }) => sum + (Number(t.cost_usd) || 0), 0))
        }
      } catch (err) {
        console.error('Failed to load workspace data:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [ws])

  const fleetAgents = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.description ?? a.type,
    status: agentStatusToDisplay(a.status),
    currentTask: a.current_task_id ? 'Running task...' : null,
    model: a.model,
    tasksCompleted: a.total_tasks_completed ?? 0,
    department: a.type.charAt(0).toUpperCase() + a.type.slice(1),
  }))

  const activeAgents = agents.filter((a) => a.status === 'running').length

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Loading workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface capitalize">
            {workspace.replace(/-/g, ' ')} Fleet
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {activeAgents} agent{activeAgents !== 1 ? 's' : ''} active
          </p>
        </div>
        <Link
          href={`/${workspace}/agents/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-on-surface text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </Link>
      </div>

      {/* Agent fleet */}
      <div className="mb-10">
        <FleetGrid agents={fleetAgents} />
      </div>

      {/* Compute servers */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Compute Servers</h2>
          <Link href={`/${workspace}/compute`} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            Manage
          </Link>
        </div>
        {servers.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No compute servers provisioned.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.map((server) => (
              <div key={server.id} className="bg-surface-base border border-outline-variant rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Server className="w-5 h-5 text-on-surface-variant" />
                      <span className={clsx(
                        'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface',
                        statusDotColor[server.status] ?? 'bg-gray-500'
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-on-surface">{server.name}</p>
                      <p className="text-xs text-on-surface-variant">{server.provider} {server.region ? `· ${server.region}` : ''}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-yellow-400">${Number(server.cost_per_hour_usd ?? 0).toFixed(3)}/hr</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-on-surface-variant">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    {server.cpu} vCPU
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    {(server.memory_mb / 1024).toFixed(0)} GB RAM
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage meters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Usage This Month</h2>
          <Link href={`/${workspace}/billing`} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            View billing
          </Link>
        </div>
        <UsageMeter
          tasksUsed={taskCount}
          tasksTotal={null}
          tokensUsed={0}
          tokensTotal={null}
          costUsd={totalCost}
          costBudget={null}
          computeHoursUsed={0}
          computeHoursTotal={null}
        />
      </div>
    </div>
  )
}
