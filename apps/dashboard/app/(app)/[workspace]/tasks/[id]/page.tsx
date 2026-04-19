'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, CheckCircle, XCircle, Clock, DollarSign, Bot, Zap, Calendar } from 'lucide-react'
import { TaskLogViewer } from '../../../../../components/tasks/task-log-viewer'
import { TaskStatusBadge } from '../../../../../components/shared/badge'
import { Button } from '../../../../../components/shared/button'
import { ConfirmModal } from '../../../../../components/shared/modal'
import { formatDistanceToNow, format } from 'date-fns'
import type { TaskStatus, TaskPriority } from '../../../../../lib/types'

// Mock task data — in production, fetched server-side
const mockTask = {
  id: 'task-123',
  title: 'Refactor authentication middleware to support OAuth 2.0',
  description: 'The current auth middleware only supports basic JWT tokens. Refactor to support OAuth 2.0 flows including PKCE, refresh tokens, and scope-based permissions.',
  status: 'running' as TaskStatus,
  priority: 'high' as TaskPriority,
  requiresApproval: true,
  agentName: 'Aria',
  agentModel: 'anthropic:claude-3-5-sonnet-20241022',
  sprint: 'Sprint 4 — API v2 Migration',
  createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  startedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  estimatedDurationSeconds: 1800,
  tokensInput: 12840,
  tokensOutput: 4290,
  costUsd: 0.042,
}

const mockInitialLogs = [
  { id: 'l1', level: 'info' as const, type: 'system' as const, message: 'Task started. Agent: Aria. Model: claude-3-5-sonnet-20241022', createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
  { id: 'l2', level: 'info' as const, type: 'agent_thought' as const, message: 'Reading task description and understanding requirements for OAuth 2.0 migration...', createdAt: new Date(Date.now() - 1000 * 60 * 19).toISOString() },
  { id: 'l3', level: 'info' as const, type: 'tool_call' as const, message: 'read_file: src/middleware/auth.ts', createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
  { id: 'l4', level: 'info' as const, type: 'tool_result' as const, message: 'File read successfully. 284 lines.', createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
  { id: 'l5', level: 'info' as const, type: 'llm_call' as const, message: 'Analyzing existing middleware structure and planning refactor approach', createdAt: new Date(Date.now() - 1000 * 60 * 17).toISOString(), tokensInput: 3200, tokensOutput: 840, durationMs: 2340 },
  { id: 'l6', level: 'info' as const, type: 'agent_action' as const, message: 'Writing new OAuth 2.0 middleware with PKCE support...', createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: 'l7', level: 'warn' as const, type: 'system' as const, message: 'Token count approaching context limit. Summarizing previous context.', createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
  { id: 'l8', level: 'info' as const, type: 'tool_call' as const, message: 'write_file: src/middleware/auth.ts', createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
  { id: 'l9', level: 'info' as const, type: 'tool_result' as const, message: 'File written successfully.', createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
]

const priorityColors: Record<TaskPriority, string> = {
  low: 'text-on-surface-variant',
  normal: 'text-blue-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

export default function TaskDetailPage() {
  const params = useParams()
  const workspace = params.workspace as string
  const taskId = params.id as string

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const handleApprove = async () => {
    setApproving(true)
    await new Promise((r) => setTimeout(r, 800))
    setApproving(false)
    setApproveOpen(false)
    // In production: mutate task status
  }

  const handleReject = async () => {
    setRejecting(true)
    await new Promise((r) => setTimeout(r, 800))
    setRejecting(false)
    setRejectOpen(false)
  }

  const elapsed = mockTask.startedAt
    ? Math.floor((Date.now() - new Date(mockTask.startedAt).getTime()) / 1000)
    : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back */}
      <Link
        href={`/${workspace}/tasks`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to tasks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <TaskStatusBadge status={mockTask.status} />
            <span className={`text-xs font-medium ${priorityColors[mockTask.priority]}`}>
              {mockTask.priority.charAt(0).toUpperCase() + mockTask.priority.slice(1)} priority
            </span>
          </div>
          <h1 className="text-xl font-bold text-on-surface leading-snug">{mockTask.title}</h1>
          {mockTask.description && (
            <p className="text-sm text-on-surface-variant mt-2">{mockTask.description}</p>
          )}
        </div>

        {/* Approval actions */}
        {mockTask.requiresApproval && mockTask.status === 'running' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRejectOpen(true)}
            >
              <XCircle className="w-4 h-4" />
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setApproveOpen(true)}
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log viewer — main area */}
        <div className="lg:col-span-2">
          <TaskLogViewer
            taskId={mockTask.id}
            streaming={mockTask.status === 'running'}
            initialLogs={mockInitialLogs}
          />
        </div>

        {/* Sidebar details */}
        <div className="space-y-4">
          {/* Task details */}
          <div className="bg-surface-base border border-outline-variant rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Details</h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Bot className="w-3.5 h-3.5" />
                  Agent
                </div>
                <span className="text-on-surface font-medium">{mockTask.agentName}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Zap className="w-3.5 h-3.5" />
                  Model
                </div>
                <span className="text-on-surface-variant text-xs font-mono truncate max-w-[140px]">
                  {mockTask.agentModel.split(':')[1]?.replace(/-\d{8}$/, '') || mockTask.agentModel}
                </span>
              </div>

              {mockTask.sprint && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Calendar className="w-3.5 h-3.5" />
                    Sprint
                  </div>
                  <span className="text-on-surface-variant text-xs truncate max-w-[140px]">{mockTask.sprint}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Clock className="w-3.5 h-3.5" />
                  Created
                </div>
                <span className="text-on-surface-variant text-xs">{formatDistanceToNow(new Date(mockTask.createdAt), { addSuffix: true })}</span>
              </div>

              {elapsed != null && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Clock className="w-3.5 h-3.5" />
                    Elapsed
                  </div>
                  <span className="text-on-surface-variant text-xs">{Math.floor(elapsed / 60)}m {elapsed % 60}s</span>
                </div>
              )}
            </div>
          </div>

          {/* Usage stats */}
          <div className="bg-surface-base border border-outline-variant rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Token Usage</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">Input tokens</span>
                <span className="text-on-surface font-mono">{mockTask.tokensInput.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">Output tokens</span>
                <span className="text-on-surface font-mono">{mockTask.tokensOutput.toLocaleString()}</span>
              </div>
              <div className="border-t border-outline-variant pt-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <DollarSign className="w-3.5 h-3.5" />
                  Cost
                </div>
                <span className="text-yellow-400 font-mono font-medium">${mockTask.costUsd.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Approval status */}
          {mockTask.requiresApproval && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-400 mb-1">Requires Approval</p>
              <p className="text-xs text-yellow-400/70">
                This task will not finalize until a human approves or rejects the output.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        title="Approve Task Output"
        description="This will mark the task as complete and finalize the output."
        confirmLabel="Approve"
        loading={approving}
      />
      <ConfirmModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Reject Task Output"
        description="This will mark the task as failed and notify the agent."
        confirmLabel="Reject"
        variant="destructive"
        loading={rejecting}
      />
    </div>
  )
}
