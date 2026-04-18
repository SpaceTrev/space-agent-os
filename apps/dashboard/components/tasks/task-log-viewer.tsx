'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { AlertCircle, Info, AlertTriangle, Terminal, RefreshCw } from 'lucide-react'
import { Button } from '../shared/button'
import type { TaskLogLevel, TaskLogType } from '../../lib/types'

interface LogEntry {
  id: string
  level: TaskLogLevel
  type: TaskLogType
  message: string
  model?: string | null
  tokensInput?: number | null
  tokensOutput?: number | null
  durationMs?: number | null
  createdAt: string
}

interface TaskLogViewerProps {
  taskId: string
  /** If true, connects to SSE stream. If false, just renders provided logs. */
  streaming?: boolean
  initialLogs?: LogEntry[]
}

const levelConfig: Record<TaskLogLevel, { icon: React.ElementType; color: string; bg: string }> = {
  debug: { icon: Terminal, color: 'text-on-surface-variant', bg: '' },
  info: { icon: Info, color: 'text-blue-400', bg: '' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/5' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/5' },
}

const typeLabels: Partial<Record<TaskLogType, string>> = {
  llm_call: 'LLM',
  tool_call: 'TOOL',
  tool_result: 'RESULT',
  agent_thought: 'THOUGHT',
  agent_action: 'ACTION',
  system: 'SYS',
  retry: 'RETRY',
  error: 'ERROR',
}

function LogLine({ entry }: { entry: LogEntry }) {
  const config = levelConfig[entry.level]
  const Icon = config.icon
  const typeLabel = typeLabels[entry.type] || entry.type.toUpperCase()
  const time = new Date(entry.createdAt).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className={clsx('flex gap-3 px-4 py-2 text-xs font-mono border-b border-outline-variant/60 hover:bg-surface-high/40', config.bg)}>
      <span className="text-on-surface-variant flex-shrink-0 w-20">{time}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0 w-16">
        <Icon className={clsx('w-3 h-3 flex-shrink-0', config.color)} />
        <span className={clsx('uppercase text-[10px] font-semibold', config.color)}>
          {entry.level}
        </span>
      </div>
      <span className="text-on-surface-variant flex-shrink-0 w-14 text-[10px] uppercase">{typeLabel}</span>
      <span className={clsx('flex-1 break-all whitespace-pre-wrap', config.color === 'text-blue-400' ? 'text-on-surface' : config.color)}>
        {entry.message}
      </span>
      {entry.durationMs != null && (
        <span className="text-on-surface-variant flex-shrink-0">{entry.durationMs}ms</span>
      )}
      {entry.tokensInput != null && (
        <span className="text-on-surface-variant flex-shrink-0">
          {entry.tokensInput}↑ {entry.tokensOutput ?? 0}↓
        </span>
      )}
    </div>
  )
}

export function TaskLogViewer({ taskId, streaming = true, initialLogs = [] }: TaskLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!streaming) return

    const connect = () => {
      setError(null)
      const es = new EventSource(`/api/tasks/${taskId}/logs`)
      esRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'log') {
            setLogs((prev) => [...prev, data.log as LogEntry])
          } else if (data.type === 'done') {
            es.close()
            setConnected(false)
          }
        } catch {
          // skip malformed
        }
      }

      es.onerror = () => {
        setConnected(false)
        setError('Connection lost. Stream ended or task completed.')
        es.close()
      }
    }

    connect()
    return () => {
      esRef.current?.close()
      setConnected(false)
    }
  }, [taskId, streaming])

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setAutoScroll(nearBottom)
  }

  return (
    <div className="flex flex-col bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant bg-surface-low">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-on-surface-variant" />
          <span className="text-xs font-medium text-on-surface-variant">Task Logs</span>
          {streaming && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'bg-green-400 animate-pulse' : 'bg-on-surface-variant/40')} />
              <span className="text-[10px] text-on-surface-variant">{connected ? 'Live' : 'Disconnected'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">{logs.length} entries</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setAutoScroll(true)}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Scroll to bottom
          </Button>
        </div>
      </div>

      {/* Log area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-[300px] max-h-[500px]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-on-surface-variant">
            {streaming ? 'Waiting for logs...' : 'No logs available'}
          </div>
        ) : (
          <>
            {logs.map((entry) => (
              <LogLine key={entry.id} entry={entry} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}
    </div>
  )
}
