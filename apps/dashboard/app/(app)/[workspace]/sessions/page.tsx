'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Plus, MessageSquare, Users } from 'lucide-react'
import { Badge } from '../../../../components/shared/badge'
import { useAuth } from '@/lib/auth-context'

interface SessionRow {
  id: string
  session_type: string
  status: string
  participants: string[]
  context: Record<string, unknown>
  started_at: string | null
  ended_at: string | null
  sprint_id: string | null
  created_at: string
}

const statusMap: Record<string, { variant: 'green' | 'gray' | 'blue' | 'red' | 'orange'; label: string }> = {
  active: { variant: 'green', label: 'Active' },
  completed: { variant: 'blue', label: 'Completed' },
  failed: { variant: 'red', label: 'Failed' },
  pending: { variant: 'gray', label: 'Pending' },
}

const typeColors: Record<string, string> = {
  planning: 'text-purple-400 bg-purple-500/10',
  standup: 'text-blue-400 bg-blue-500/10',
  strategy: 'text-orange-400 bg-orange-500/10',
  retro: 'text-green-400 bg-green-500/10',
  refinement: 'text-yellow-400 bg-yellow-500/10',
}

function formatDuration(started: string | null, ended: string | null): string {
  if (!started) return '—'
  const start = new Date(started).getTime()
  const end = ended ? new Date(ended).getTime() : Date.now()
  const secs = Math.round((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  return `${(secs / 3600).toFixed(1)}h`
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function SessionsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return
    fetch(`/api/sessions?workspace_id=${ws.id}`)
      .then((r) => r.ok ? r.json() : { sessions: [] })
      .then((data) => setSessions(data.sessions ?? []))
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
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sessions.length} sessions in this workspace</p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-300">No sessions yet</p>
          <p className="text-xs text-gray-500 mt-1">Sessions are collaborative agent runs — standups, planning, retros</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_120px_100px_100px] text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 border-b border-gray-800 bg-gray-900">
            <span>Session</span>
            <span>Type</span>
            <span>Agents</span>
            <span>Started</span>
            <span>Duration</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-gray-800">
            {sessions.map((session) => {
              const statusConfig = statusMap[session.status] || { variant: 'gray' as const, label: session.status }
              const goal = (session.context?.goal as string) ?? session.session_type
              return (
                <Link
                  key={session.id}
                  href={`/${workspace}/sessions/${session.id}`}
                  className="grid grid-cols-[1fr_120px_100px_120px_100px_100px] items-center px-5 py-3.5 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{goal}</p>
                      <p className="text-xs text-gray-500 truncate">{session.id}</p>
                    </div>
                  </div>
                  <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium w-fit', typeColors[session.session_type] ?? 'text-gray-400 bg-gray-500/10')}>
                    {session.session_type}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5 text-gray-600" />
                    {session.participants?.length ?? 0}
                  </div>
                  <span className="text-xs text-gray-400">
                    {session.started_at ? formatRelative(session.started_at) : '—'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDuration(session.started_at, session.ended_at)}
                  </span>
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
