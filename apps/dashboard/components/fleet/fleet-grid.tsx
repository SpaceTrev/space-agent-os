'use client'

import { AgentCard, AgentDisplayStatus } from './agent-card'

interface AgentData {
  id: string
  name: string
  role: string
  status: AgentDisplayStatus
  currentTask?: string | null
  model: string
  tasksCompleted: number
  department?: string
}

interface DepartmentGroup {
  department: string
  agents: AgentData[]
}

interface FleetGridProps {
  agents: AgentData[]
  onAgentClick?: (agentId: string) => void
}

function groupByDepartment(agents: AgentData[]): DepartmentGroup[] {
  const map = new Map<string, AgentData[]>()
  for (const agent of agents) {
    const dept = agent.department || 'General'
    if (!map.has(dept)) map.set(dept, [])
    map.get(dept)!.push(agent)
  }
  return Array.from(map.entries()).map(([department, agents]) => ({ department, agents }))
}

export function FleetGrid({ agents, onAgentClick }: FleetGridProps) {
  const groups = groupByDepartment(agents)

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-high border border-outline-variant flex items-center justify-center mb-4">
          <span className="text-3xl">🤖</span>
        </div>
        <p className="text-sm font-medium text-on-surface">No agents yet</p>
        <p className="text-xs text-on-surface-variant mt-1">Create your first agent to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.department}>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              {group.department}
            </h2>
            <div className="flex-1 h-px bg-surface-high" />
            <span className="text-xs text-on-surface-variant">{group.agents.length} agents</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.agents.map((agent) => (
              <AgentCard
                key={agent.id}
                {...agent}
                onClick={onAgentClick ? () => onAgentClick(agent.id) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
