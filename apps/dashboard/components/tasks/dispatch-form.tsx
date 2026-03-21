'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Send, ChevronDown } from 'lucide-react'
import { Button } from '../shared/button'
import { Input, Textarea, Select } from '../shared/input'
import type { TaskPriority } from '../../lib/types'

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

interface DispatchFormProps {
  agents: AgentOption[]
  sprints?: SprintOption[]
  onDispatch: (data: DispatchPayload) => Promise<void>
  onCancel?: () => void
}

export interface DispatchPayload {
  agentId: string
  prompt: string
  sprintId?: string
  priority: TaskPriority
  requiresApproval: boolean
}

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export function DispatchForm({ agents, sprints = [], onDispatch, onCancel }: DispatchFormProps) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [prompt, setPrompt] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agentOptions = agents.map((a) => ({
    value: a.id,
    label: `${a.name} — ${a.role}`,
  }))

  const sprintOptions = [
    { value: '', label: 'No sprint' },
    ...sprints.map((s) => ({ value: s.id, label: s.name })),
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) {
      setError('Prompt is required')
      return
    }
    if (!agentId) {
      setError('Please select an agent')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onDispatch({
        agentId,
        prompt: prompt.trim(),
        sprintId: sprintId || undefined,
        priority,
        requiresApproval,
      })
      setPrompt('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Select
        label="Assign to Agent"
        options={agentOptions}
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        disabled={agents.length === 0}
      />

      <Textarea
        label="Task Prompt"
        placeholder="Describe the task you want the agent to perform..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        className="min-h-[100px]"
        hint="Be specific. The agent will follow this prompt to complete the task."
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Priority"
          options={priorityOptions}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        />
        {sprints.length > 0 && (
          <Select
            label="Sprint (optional)"
            options={sprintOptions}
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
          />
        )}
      </div>

      {/* Requires approval toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-200">Requires Approval</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Task will pause for human review before finalizing
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRequiresApproval((v) => !v)}
          className={clsx(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
            requiresApproval ? 'bg-brand-600' : 'bg-gray-700'
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              requiresApproval ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} fullWidth>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          <Send className="w-4 h-4" />
          Dispatch Task
        </Button>
      </div>
    </form>
  )
}
