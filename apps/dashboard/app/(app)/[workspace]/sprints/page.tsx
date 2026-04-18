'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Plus, GitBranch } from 'lucide-react'
import { SprintBoard } from '../../../../components/sprints/sprint-board'
import { Modal } from '../../../../components/shared/modal'
import { Button } from '../../../../components/shared/button'
import { Input, Textarea } from '../../../../components/shared/input'
import { useAuth } from '@/lib/auth-context'
import type { SprintStatus, TaskStatus, TaskPriority } from '../../../../lib/types'

interface SprintRow {
  id: string
  name: string
  description: string | null
  status: SprintStatus
  goal: string | null
  starts_at: string | null
  ends_at: string | null
  completed_at: string | null
}

interface SprintDisplay {
  id: string
  name: string
  description: string | null
  status: SprintStatus
  goal: string | null
  startsAt: string | null
  endsAt: string | null
  completedAt?: string | null
  stats: {
    totalTasks: number
    completedTasks: number
    failedTasks: number
    inProgressTasks: number
    totalTokensUsed: number
    totalCostUsd: number
    avgTaskDurationSeconds: number
  }
  tasks: { id: string; title: string; status: TaskStatus; priority: TaskPriority; agentName: string | null; costUsd: number }[]
}

export default function SprintsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [sprints, setSprints] = useState<SprintDisplay[]>([])
  const [newSprintOpen, setNewSprintOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return

    async function load() {
      try {
        const sprintsRes = await fetch(`/api/sprints?workspace_id=${ws!.id}`)
        if (!sprintsRes.ok) { setLoading(false); return }
        const sprintsData = await sprintsRes.json()
        const rawSprints: SprintRow[] = sprintsData.sprints ?? []

        // For each sprint, fetch its tasks
        const sprintDisplays = await Promise.all(rawSprints.map(async (s) => {
          const tasksRes = await fetch(`/api/tasks?workspace_id=${ws!.id}&sprint_id=${s.id}&per_page=50`)
          const tasks = tasksRes.ok ? (await tasksRes.json()).tasks ?? [] : []

          const completed = tasks.filter((t: { status: string }) => t.status === 'completed').length
          const failed = tasks.filter((t: { status: string }) => t.status === 'failed').length
          const inProgress = tasks.filter((t: { status: string }) => t.status === 'running' || t.status === 'queued').length
          const totalCost = tasks.reduce((sum: number, t: { cost_usd: number }) => sum + (Number(t.cost_usd) || 0), 0)
          const totalTokens = tasks.reduce((sum: number, t: { tokens_input: number; tokens_output: number }) => sum + (Number(t.tokens_input) || 0) + (Number(t.tokens_output) || 0), 0)

          return {
            id: s.id,
            name: s.name,
            description: s.description,
            status: s.status,
            goal: s.goal,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            completedAt: s.completed_at,
            stats: {
              totalTasks: tasks.length,
              completedTasks: completed,
              failedTasks: failed,
              inProgressTasks: inProgress,
              totalTokensUsed: totalTokens,
              totalCostUsd: totalCost,
              avgTaskDurationSeconds: 0,
            },
            tasks: tasks.slice(0, 6).map((t: { id: string; title: string; status: TaskStatus; priority: TaskPriority; cost_usd: number; agent?: { name: string } | null }) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              agentName: t.agent?.name ?? null,
              costUsd: Number(t.cost_usd) || 0,
            })),
          } satisfies SprintDisplay
        }))

        setSprints(sprintDisplays)
      } catch (err) {
        console.error('Failed to load sprints:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [ws])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ws || !name.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: ws.id,
          name: name.trim(),
          goal: goal.trim() || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newSprint: SprintDisplay = {
          id: data.sprint.id,
          name: data.sprint.name,
          description: data.sprint.description,
          status: data.sprint.status,
          goal: data.sprint.goal,
          startsAt: data.sprint.starts_at,
          endsAt: data.sprint.ends_at,
          stats: { totalTasks: 0, completedTasks: 0, failedTasks: 0, inProgressTasks: 0, totalTokensUsed: 0, totalCostUsd: 0, avgTaskDurationSeconds: 0 },
          tasks: [],
        }
        setSprints((prev) => [newSprint, ...prev])
      }
    } catch (err) {
      console.error('Failed to create sprint:', err)
    } finally {
      setCreating(false)
      setNewSprintOpen(false)
      setName('')
      setGoal('')
    }
  }

  const activeSprint = sprints.find((s) => s.status === 'active')
  const otherSprints = sprints.filter((s) => s.status !== 'active')

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sprints</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{sprints.length} sprints total</p>
        </div>
        <Button variant="primary" onClick={() => setNewSprintOpen(true)}>
          <Plus className="w-4 h-4" />
          New Sprint
        </Button>
      </div>

      {sprints.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-high border border-outline-variant flex items-center justify-center mb-4">
            <GitBranch className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-sm font-medium text-on-surface">No sprints yet</p>
          <p className="text-xs text-on-surface-variant mt-1">Create a sprint to organize your agent tasks</p>
        </div>
      )}

      {/* Active sprint */}
      {activeSprint && (
        <div className="mb-8 group">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Active Sprint</span>
          </div>
          <Link href={`/${workspace}/sprints/${activeSprint.id}`} className="block transition-transform group-hover:-translate-y-1 duration-300">
            <SprintBoard {...activeSprint} />
          </Link>
        </div>
      )}

      {/* Other sprints */}
      {otherSprints.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">All Sprints</h2>
          <div className="space-y-4">
            {otherSprints.map((sprint) => (
              <Link key={sprint.id} href={`/${workspace}/sprints/${sprint.id}`} className="block transition-transform hover:-translate-y-1 duration-300">
                <SprintBoard {...sprint} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* New sprint modal */}
      <Modal
        open={newSprintOpen}
        onClose={() => setNewSprintOpen(false)}
        title="Create Sprint"
        description="Organize tasks into a focused sprint"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewSprintOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate}>
              <GitBranch className="w-4 h-4" />
              Create Sprint
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Sprint Name"
            placeholder="Sprint 5 — Performance"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Textarea
            label="Goal (optional)"
            placeholder="What does success look like for this sprint?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  )
}
