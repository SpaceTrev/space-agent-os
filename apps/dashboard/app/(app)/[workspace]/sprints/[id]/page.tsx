'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, Sparkles, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'
import { SprintBoard } from '../../../../../components/sprints/sprint-board'
import { clsx } from 'clsx'
import type { SprintStatus, TaskStatus, TaskPriority } from '../../../../../lib/types'

const mockSprints = [
  {
    id: 's1',
    name: 'Sprint 4 — API v2 Migration',
    description: 'Migrate all public-facing endpoints to v2 API with OAuth 2.0 support',
    status: 'active' as SprintStatus,
    goal: 'Complete OAuth 2.0 implementation and migrate 100% of endpoints by March 31',
    startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    stats: {
      totalTasks: 18,
      completedTasks: 11,
      failedTasks: 1,
      inProgressTasks: 3,
      totalTokensUsed: 4_820_000,
      totalCostUsd: 67.4,
      avgTaskDurationSeconds: 420,
    },
    tasks: [
      { id: 't1', title: 'Refactor auth middleware for OAuth 2.0', status: 'completed' as TaskStatus, priority: 'high' as TaskPriority, agentName: 'Aria', costUsd: 0.042 },
      { id: 't2', title: 'Write OpenAPI spec for payment service', status: 'running' as TaskStatus, priority: 'normal' as TaskPriority, agentName: 'Dev-2', costUsd: 0.018 },
      { id: 't3', title: 'Generate unit tests for UserService', status: 'completed' as TaskStatus, priority: 'normal' as TaskPriority, agentName: 'Dev-1', costUsd: 0.067 },
      { id: 't4', title: 'Migrate user endpoints to v2', status: 'completed' as TaskStatus, priority: 'high' as TaskPriority, agentName: 'Aria', costUsd: 0.095 },
      { id: 't5', title: 'Analyze DB query performance', status: 'failed' as TaskStatus, priority: 'critical' as TaskPriority, agentName: 'Dev-2', costUsd: 0.012 },
      { id: 't6', title: 'Review PR #248 — Rate limiting', status: 'queued' as TaskStatus, priority: 'high' as TaskPriority, agentName: 'QA-Bot', costUsd: 0 },
    ],
  },
  // ... fallback for others if accessed
]

const mockStandups = [
  {
    date: 'Today, 9:00 AM',
    updates: [
      { 
        agent: 'Aria', 
        role: 'Senior Backend', 
        status: 'on-track',
        done: 'Completed user endpoint migrations to v2.',
        doing: 'Starting rate-limiter middleware review.',
        blockers: 'None.'
      },
      { 
        agent: 'Dev-2', 
        role: 'API Specialist', 
        status: 'blocked',
        done: 'Wrote OpenAPI spec for payment service.',
        doing: 'Analyzing DB query performance.',
        blockers: 'Failing on query analysis due to missing index on users table. Need Orchestrator approval to run migration.'
      },
      { 
        agent: 'QA-Bot', 
        role: 'QA Automation', 
        status: 'on-track',
        done: 'Generated E2E test stubs.',
        doing: 'Waiting on rate limiting PR to begin integration tests.',
        blockers: 'None.'
      }
    ]
  },
  {
    date: 'Yesterday, 9:00 AM',
    updates: [
      { 
        agent: 'Aria', 
        role: 'Senior Backend', 
        status: 'on-track',
        done: 'Refactored auth middleware for OAuth 2.0.',
        doing: 'Migrating user endpoints to v2.',
        blockers: 'None.'
      },
      { 
        agent: 'Dev-1', 
        role: 'Backend Developer', 
        status: 'on-track',
        done: 'Generated unit tests for UserService.',
        doing: 'Standing by for next assignment.',
        blockers: 'None.'
      }
    ]
  }
]

export default function SprintDetailPage({ params }: { params: Promise<{ workspace: string, id: string }> }) {
  const { workspace, id } = use(params)
  const [activeTab, setActiveTab] = useState<'board' | 'standups' | 'retro'>('board')

  const sprint = mockSprints.find(s => s.id === id) || mockSprints[0]

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back Link */}
      <Link href={`/${workspace}/sprints`} className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Sprints
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-on-surface mb-2">{sprint.name}</h1>
        <p className="text-on-surface-variant max-w-2xl">{sprint.description}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-outline-variant mb-8">
        <button
          onClick={() => setActiveTab('board')}
          className={clsx(
            "pb-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'board' ? "border-brand-500 text-brand-400" : "border-transparent text-on-surface-variant hover:text-on-surface"
          )}
        >
          Board
        </button>
        <button
          onClick={() => setActiveTab('standups')}
          className={clsx(
            "pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'standups' ? "border-brand-500 text-brand-400" : "border-transparent text-on-surface-variant hover:text-on-surface"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Daily Standups
        </button>
        <button
          onClick={() => setActiveTab('retro')}
          className={clsx(
            "pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'retro' ? "border-brand-500 text-brand-400" : "border-transparent text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Sparkles className="w-4 h-4" />
          Retrospective
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'board' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SprintBoard {...sprint} />
        </div>
      )}

      {activeTab === 'standups' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {mockStandups.map((standup, i) => (
            <div key={i} className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
              <div className="bg-surface-high px-5 py-3 border-b border-outline-variant">
                <h3 className="text-sm font-medium text-on-surface">{standup.date}</h3>
              </div>
              <div className="divide-y divide-gray-800 flex flex-col">
                {standup.updates.map((update, j) => (
                  <div key={j} className="p-5 flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-surface-high border border-outline-variant flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-5 h-5 text-on-surface-variant" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-semibold text-on-surface mr-2">{update.agent}</span>
                          <span className="text-xs text-on-surface-variant">{update.role}</span>
                        </div>
                        {update.status === 'blocked' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded">
                            <AlertCircle className="w-3 h-3" /> Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded">
                            <CheckCircle2 className="w-3 h-3" /> On Track
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 text-sm text-on-surface">
                        <p><strong className="text-on-surface-variant font-medium">Done:</strong> {update.done}</p>
                        <p><strong className="text-on-surface-variant font-medium">Doing:</strong> {update.doing}</p>
                        {update.blockers !== 'None.' && (
                          <p className="text-red-300"><strong className="text-red-400/70 font-medium">Blockers:</strong> {update.blockers}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'retro' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-gradient-to-br from-brand-900/40 to-indigo-900/20 border border-brand-500/20 rounded-xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles className="w-32 h-32 text-brand-400" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <Sparkles className="w-6 h-6 text-brand-400" />
              <h2 className="text-xl font-bold text-on-surface">AI Generated Retrospective</h2>
            </div>
            
            <div className="space-y-6 relative z-10">
              <section>
                <h3 className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-2">Sprint Summary</h3>
                <p className="text-on-surface leading-relaxed text-sm">
                  The Swarm completed 61% of tasks currently, tracking slightly behind ideal velocity to complete the API v2 Migration goal by March 31.
                  The primary bottleneck encountered was a missing database index which blocked `Dev-2` from completing query analysis, failing task `t5`.
                </p>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-2">Token Economics</h3>
                <p className="text-on-surface leading-relaxed text-sm">
                  Total cost sits at <strong>$67.40</strong> burning <strong>4.82M tokens</strong>. 
                  Token efficiency dropped during the `UserService` refactoring loop due to multiple iterative context reprompts from `Dev-1`. 
                  Recommend breaking down context windows for large refactors.
                </p>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-2">Action Items</h3>
                <ul className="list-disc list-inside text-on-surface space-y-1 text-sm">
                  <li>Orchestrator to approve and run `users` table index migration to unblock Dev-2.</li>
                  <li>Adjust Agent `Dev-1`'s system prompt to handle testing in smaller file increments to save context tokens.</li>
                  <li>Schedule QA-Bot integration tests to run automatically once PR #248 merges.</li>
                </ul>
              </section>
            </div>

            <div className="mt-8 pt-6 border-t border-brand-500/20 flex items-center justify-between relative z-10">
              <p className="text-xs text-brand-400/60 font-mono">Generated by Orchestrator Agent (Claude 3.5 Sonnet)</p>
              <button className="text-sm text-white font-medium bg-brand-600 hover:bg-brand-500 px-4 py-2 rounded-lg transition-colors">
                Apply Action Items to Next Sprint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
