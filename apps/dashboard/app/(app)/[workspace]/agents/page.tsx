'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Plus, Bot, CheckCircle } from 'lucide-react'
import { Badge } from '../../../../components/shared/badge'
import { useAuth } from '@/lib/auth-context'

interface AgentRow {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  model: string
  total_tasks_completed: number
}

const statusMap: Record<string, { variant: 'green' | 'gray' | 'yellow' | 'blue' | 'red' | 'orange'; label: string }> = {
  running: { variant: 'green', label: 'Running' },
  idle: { variant: 'gray', label: 'Idle' },
  paused: { variant: 'orange', label: 'Paused' },
  error: { variant: 'red', label: 'Error' },
  archived: { variant: 'gray', label: 'Archived' },
}

const typeColors: Record<string, string> = {
  worker: 'text-blue-400 bg-blue-500/10',
  orchestrator: 'text-purple-400 bg-purple-500/10',
  specialist: 'text-orange-400 bg-orange-500/10',
  reviewer: 'text-green-400 bg-green-500/10',
}

function modelShortName(model: string): string {
  const parts = model.split(':')
  const name = parts[parts.length - 1]
  return name.replace(/-\d{8}$/, '').slice(0, 28)
}

export default function AgentsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return
    fetch(`/api/agents?workspace_id=${ws.id}`)
      .then((r) => r.ok ? r.json() : { agents: [] })
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ws])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{agents.length} agents in this workspace</p>
        </div>
        <Link
          href={`/${workspace}/agents/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-high border border-outline-variant flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-sm font-medium text-on-surface">No agents yet</p>
          <p className="text-xs text-on-surface-variant mt-1">Create your first agent to get started</p>
        </div>
      ) : (
        <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_140px_100px_100px] text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-5 py-3 border-b border-outline-variant bg-surface-base">
            <span>Agent</span>
            <span>Type</span>
            <span>Model</span>
            <span>Tasks</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-gray-800">
            {agents.map((agent) => {
              const statusConfig = statusMap[agent.status] || { variant: 'gray' as const, label: agent.status }
              return (
                <Link
                  key={agent.id}
                  href={`/${workspace}/agents/${agent.id}`}
                  className="grid grid-cols-[1fr_140px_140px_100px_100px] items-center px-5 py-3.5 hover:bg-surface-high/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-high border border-outline-variant flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{agent.description ?? agent.type}</p>
                    </div>
                  </div>
                  <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium w-fit', typeColors[agent.type] ?? 'text-on-surface-variant bg-gray-500/10')}>
                    {agent.type}
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono truncate">{modelShortName(agent.model)}</span>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <CheckCircle className="w-3.5 h-3.5 text-on-surface-variant" />
                    {agent.total_tasks_completed ?? 0}
                  </div>
                  <Badge variant={statusConfig.variant} dot size="sm">
                    {statusConfig.label}
                  </Badge>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
