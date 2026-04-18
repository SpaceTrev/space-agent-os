'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { ArrowLeft, MessageSquare, Users, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Badge } from '../../../../../components/shared/badge'
import { useAuth } from '@/lib/auth-context'

interface SessionDetail {
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

interface SessionMessage {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

const statusMap: Record<string, { variant: 'green' | 'gray' | 'blue' | 'red' | 'orange'; label: string; icon: React.ReactNode }> = {
  active: { variant: 'green', label: 'Active', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  completed: { variant: 'blue', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> },
  failed: { variant: 'red', label: 'Failed', icon: <XCircle className="w-4 h-4" /> },
  pending: { variant: 'gray', label: 'Pending', icon: <Clock className="w-4 h-4" /> },
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

export default function SessionDetailPage({ params }: { params: Promise<{ workspace: string; id: string }> }) {
  const { workspace, id } = use(params)
  const { workspaces } = useAuth()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (ws === undefined) return // still loading auth
    fetch(`/api/sessions/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Session not found')))
      .then((data) => {
        setSession(data.session)
        setMessages(data.messages ?? [])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [ws, id])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href={`/${workspace}/sessions`} className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to sessions
        </Link>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error ?? 'Session not found'}
        </div>
      </div>
    )
  }

  const statusConfig = statusMap[session.status] || { variant: 'gray' as const, label: session.status, icon: null }
  const goal = (session.context?.goal as string) ?? session.session_type

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href={`/${workspace}/sessions`} className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to sessions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-high border border-outline-variant flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{goal}</h1>
            <p className="text-sm text-on-surface-variant mt-0.5 capitalize">{session.session_type} session</p>
          </div>
        </div>
        <Badge variant={statusConfig.variant} dot size="sm">{statusConfig.label}</Badge>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Participants</span>
          </div>
          <p className="text-lg font-semibold text-white">{session.participants?.length ?? 0} agents</p>
        </div>
        <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Duration</span>
          </div>
          <p className="text-lg font-semibold text-white">{formatDuration(session.started_at, session.ended_at)}</p>
        </div>
        <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Messages</span>
          </div>
          <p className="text-lg font-semibold text-white">{messages.length}</p>
        </div>
      </div>

      {/* Message thread */}
      <div>
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Conversation</h2>
        {messages.length === 0 ? (
          <div className="bg-surface-base border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
            No messages yet
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div key={msg.id} className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
                  <div className={clsx(
                    'max-w-[75%] rounded-2xl px-4 py-3',
                    isUser
                      ? 'bg-brand-600/20 border border-brand-500/30'
                      : 'bg-surface-high border border-outline-variant'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('text-xs font-medium', isUser ? 'text-brand-400' : 'text-on-surface-variant')}>
                        {isUser ? 'You' : 'Agent'}
                      </span>
                      <span className="text-xs text-on-surface-variant">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer timestamps */}
      {session.started_at && (
        <div className="mt-8 pt-6 border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
          <span>Started {formatDate(session.started_at)}</span>
          {session.ended_at && <span>Ended {formatDate(session.ended_at)}</span>}
        </div>
      )}
    </div>
  )
}
