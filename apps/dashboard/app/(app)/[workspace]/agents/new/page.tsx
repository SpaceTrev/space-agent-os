'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Bot, Plus, X } from 'lucide-react'
import { Input, Textarea, Select } from '../../../../../components/shared/input'
import { Button } from '../../../../../components/shared/button'
import { ModelPicker } from '../../../../../components/models/model-picker'
import type { ModelProviderType } from '../../../../../lib/types'

interface PickerModel {
  id: string
  name: string
  provider: ModelProviderType
  providerName: string
  contextWindow?: number
  isFree: boolean
  inputCostPerMillion?: number
}

const departmentOptions = [
  { value: '', label: 'No department' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Support', label: 'Support' },
  { value: 'Data Science', label: 'Data Science' },
  { value: 'Finance', label: 'Finance' },
]

const agentTypeOptions = [
  { value: 'worker', label: 'Worker — Executes tasks directly' },
  { value: 'orchestrator', label: 'Orchestrator — Manages other agents' },
  { value: 'specialist', label: 'Specialist — Specific domain expertise' },
  { value: 'reviewer', label: 'Reviewer — Reviews and approves work' },
]

export default function NewAgentPage() {
  const router = useRouter()
  const params = useParams()
  const workspace = params.workspace as string

  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('')
  const [type, setType] = useState('worker')
  const [model, setModel] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [personality, setPersonality] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<PickerModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models/available')
        if (!res.ok) return
        const data = await res.json()
        const pickerModels: PickerModel[] = data.picker_models ?? []
        setModels(pickerModels)
        if (pickerModels.length > 0 && !model) {
          // Default to first free model, or first model overall
          const firstFree = pickerModels.find((m) => m.isFree)
          setModel((firstFree ?? pickerModels[0]).id)
        }
      } catch {
        // Non-fatal — ModelPicker will show empty state
      } finally {
        setModelsLoading(false)
      }
    }
    fetchModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills((prev) => [...prev, newSkill.trim()])
      setNewSkill('')
    }
  }

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Agent name is required')
      return
    }
    if (!role.trim()) {
      setError('Agent role is required')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, department, type, model, systemPrompt, personality }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to create agent')
      }
      router.push(`/${workspace}/agents`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href={`/${workspace}/agents`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to agents
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-surface-high border border-outline-variant flex items-center justify-center">
          <Bot className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Create New Agent</h1>
          <p className="text-sm text-on-surface-variant">Configure your AI agent for the {workspace} workspace</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white mb-4">Basic Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Agent Name"
              placeholder="e.g. Aria, Dev-3, Scout"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Role / Title"
              placeholder="e.g. Senior Backend Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Agent Type"
              options={agentTypeOptions}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <Select
              label="Department"
              options={departmentOptions}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
        </div>

        {/* Model selection */}
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Model Configuration</h2>
          <ModelPicker
            label="AI Model"
            models={models}
            value={model}
            onChange={setModel}
            disabled={modelsLoading}
            placeholder={modelsLoading ? 'Loading models...' : 'Select a model...'}
          />
          <p className="mt-2 text-xs text-on-surface-variant">
            The model this agent will use for all tasks. Can be changed later.
          </p>
        </div>

        {/* System prompt */}
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white mb-1">Behavior</h2>

          <Textarea
            label="System Prompt"
            placeholder="You are an expert backend engineer specializing in Python and distributed systems..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            hint="This is the core instruction set for your agent. Be specific about capabilities and constraints."
          />

          <Textarea
            label="Personality (optional)"
            placeholder="Professional, precise, and concise. Prefers well-documented code with clear comments..."
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={3}
            hint="Describe the agent's communication style and work approach."
          />
        </div>

        {/* Skill files */}
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Skill Files</h2>
          <p className="text-xs text-on-surface-variant mb-4">
            Add reference documents, API specs, or code snippets the agent can use.
          </p>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {skills.map((skill) => (
                <div key={skill} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-high border border-outline-variant rounded-lg text-xs text-on-surface">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-on-surface-variant hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="Add skill file name..."
              className="flex-1 rounded-lg border border-outline-variant bg-surface-high text-sm text-white placeholder-on-surface-variant/50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <Button type="button" variant="outline" size="sm" onClick={addSkill}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/${workspace}/agents`)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            <Bot className="w-4 h-4" />
            Create Agent
          </Button>
        </div>
      </form>
    </div>
  )
}
