'use client'

import { useState, useEffect, use } from 'react'
import { TaskQueue } from '../../../../components/tasks/task-queue'
import { DispatchForm } from '../../../../components/tasks/dispatch-form'
import { Modal } from '../../../../components/shared/modal'
import { Button } from '../../../../components/shared/button'
import { Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import type { TaskStatus, TaskPriority } from '../../../../lib/types'

interface TaskRow {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  cost_usd: number
  created_at: string
  agent?: { id: string; name: string } | null
}

interface AgentOption {
  id: string
  name: string
  role: string
  status: string
}

interface SprintOption {
  id: string
  name: string
}

export default function TasksPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [tasks, setTasks] = useState<{ id: string; title: string; status: TaskStatus; priority: TaskPriority; agentName: string | null; createdAt: string; costUsd: number }[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [sprints, setSprints] = useState<SprintOption[]>([])
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return

    async function load() {
      try {
        const [tasksRes, agentsRes, sprintsRes] = await Promise.all([
          fetch(`/api/tasks?workspace_id=${ws!.id}&per_page=50`),
          fetch(`/api/agents?workspace_id=${ws!.id}`),
          fetch(`/api/sprints?workspace_id=${ws!.id}`),
        ])

        if (tasksRes.ok) {
          const data = await tasksRes.json()
          setTasks((data.tasks ?? []).map((t: TaskRow) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            agentName: t.agent?.name ?? null,
            createdAt: t.created_at,
            costUsd: Number(t.cost_usd) || 0,
          })))
        }
        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents((data.agents ?? []).map((a: { id: string; name: string; description: string | null; type: string; status: string }) => ({
            id: a.id,
            name: a.name,
            role: a.description ?? a.type,
            status: a.status,
          })))
        }
        if (sprintsRes.ok) {
          const data = await sprintsRes.json()
          setSprints((data.sprints ?? []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          })))
        }
      } catch (err) {
        console.error('Failed to load tasks:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [ws])

  const handleDispatch = async (data: {
    agentId: string
    prompt: string
    sprintId?: string
    priority: TaskPriority
    requiresApproval: boolean
  }) => {
    if (!ws) return

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: ws.id,
        agent_id: data.agentId,
        title: data.prompt.length > 120 ? data.prompt.slice(0, 120) + '...' : data.prompt,
        description: data.prompt,
        sprint_id: data.sprintId || undefined,
        priority: data.priority,
        requires_approval: data.requiresApproval,
      }),
    })

    if (res.ok) {
      const result = await res.json()
      const agent = agents.find((a) => a.id === data.agentId)
      setTasks((prev) => [{
        id: result.task.id,
        title: result.task.title,
        status: result.task.status,
        priority: result.task.priority,
        agentName: agent?.name ?? null,
        createdAt: result.task.created_at,
        costUsd: 0,
      }, ...prev])
    }
    setDispatchOpen(false)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tasks.length} total tasks</p>
        </div>
        <Button variant="primary" onClick={() => setDispatchOpen(true)}>
          <Send className="w-4 h-4" />
          Dispatch Task
        </Button>
      </div>

      {/* Task queue */}
      <TaskQueue
        tasks={tasks}
        onTaskClick={(id) => {
          window.location.href = `/${workspace}/tasks/${id}`
        }}
      />

      {/* Dispatch modal */}
      <Modal
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        title="Dispatch New Task"
        description="Assign a task to an agent in this workspace"
        size="lg"
      >
        <DispatchForm
          agents={agents}
          sprints={sprints}
          onDispatch={handleDispatch}
          onCancel={() => setDispatchOpen(false)}
        />
      </Modal>
    </div>
  )
}
