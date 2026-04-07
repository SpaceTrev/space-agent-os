'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Bot, ArrowLeft, ChevronRight, Check, Zap } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Industry =
  | 'E-commerce / Retail'
  | 'Logistics'
  | 'Finance'
  | 'Restaurant / Food'
  | 'Consulting'
  | 'Marketing / Agency'
  | 'Technology'
  | 'Other'

type TeamSize = 'Just me' | '2–5' | '5–20' | '20+'

interface AgentCard {
  name: string
  description: string
  tier: 'Primary' | 'Worker' | 'Local'
}

// ─── Industry Detection ──────────────────────────────────────────────────────

function detectIndustry(text: string): Industry {
  const t = text.toLowerCase()
  if (/ecomm|e-comm|store|shop|retail|craft|product|sell|merch|tienda|venta/.test(t)) return 'E-commerce / Retail'
  if (/logistic|shipping|freight|warehouse|transport|delivery|fleet/.test(t)) return 'Logistics'
  if (/financ|bank|invest|trading|accounting|tax|crypto|insuranc/.test(t)) return 'Finance'
  if (/restaurant|food|kitchen|chef|menu|cafe|catering|bar/.test(t)) return 'Restaurant / Food'
  if (/consult|advisor|strateg|coach|freelanc/.test(t)) return 'Consulting'
  if (/market|agency|advertis|brand|creative|content|social|media|pr /.test(t)) return 'Marketing / Agency'
  if (/software|saas|tech|develop|engineer|code|app|platform|startup/.test(t)) return 'Technology'
  return 'Other'
}

// ─── Agent Recommendation Logic ──────────────────────────────────────────────

function buildAgentTeam(workflows: string[], tools: string[]): AgentCard[] {
  const team: AgentCard[] = [
    {
      name: 'Context Agent',
      description: 'Maintains shared memory and coordinates context across your agent team.',
      tier: 'Primary',
    },
    {
      name: 'PM Agent',
      description: 'Manages tasks, sprints, and priorities across all active workflows.',
      tier: 'Primary',
    },
  ]

  if (workflows.includes('Customer service')) {
    team.push({
      name: 'Customer Service Agent',
      description: 'Handles support tickets, responds to inquiries, and escalates complex issues.',
      tier: 'Worker',
    })
  }

  if (workflows.includes('Content creation') || workflows.includes('Social media')) {
    team.push({
      name: 'Marketing Agent',
      description: 'Drafts content, manages social posts, and runs campaign workflows.',
      tier: 'Worker',
    })
  }

  if (workflows.includes('Sales outreach')) {
    team.push({
      name: 'Sales Agent',
      description: 'Researches prospects, writes outreach sequences, and tracks pipeline.',
      tier: 'Worker',
    })
  }

  if (workflows.includes('Research') || workflows.includes('Data analysis')) {
    team.push({
      name: 'Researcher Agent',
      description: 'Gathers intel, summarizes reports, and surfaces insights on demand.',
      tier: 'Worker',
    })
  }

  if (workflows.includes('Email management') || workflows.includes('Scheduling')) {
    team.push({
      name: 'Assistant Agent',
      description: 'Manages your inbox, calendar, and daily coordination tasks.',
      tier: 'Worker',
    })
  }

  if (tools.includes('GitHub')) {
    team.push({
      name: 'Backend Engineer',
      description: 'Reviews PRs, automates CI tasks, and handles backend codebase operations.',
      tier: 'Local',
    })
    team.push({
      name: 'Frontend Engineer',
      description: 'Manages UI components, bug fixes, and front-end feature work.',
      tier: 'Local',
    })
  }

  // Cap at 5 agents beyond the 2 base ones — take most relevant
  return team.slice(0, 6)
}

// ─── Terminal Animation Lines ─────────────────────────────────────────────────

const TERMINAL_LINES = [
  'Analyzing your business...',
  'Selecting agent roles...',
  'Loading industry knowledge...',
  'Configuring workflows...',
  'Assembling your team...',
]

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: AgentCard['tier'] }) {
  return (
    <span
      className={clsx(
        'text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full',
        tier === 'Primary' && 'bg-brand-500/15 text-brand-400 border border-brand-500/20',
        tier === 'Worker' && 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
        tier === 'Local' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
      )}
    >
      {tier}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [visible, setVisible] = useState(true)

  // Step 1
  const [businessDesc, setBusinessDesc] = useState('')

  // Step 2
  const [industry, setIndustry] = useState<Industry>('Other')
  const [teamSize, setTeamSize] = useState<TeamSize | null>(null)

  // Step 3
  const [workflows, setWorkflows] = useState<string[]>([])

  // Step 4
  const [tools, setTools] = useState<string[]>([])

  // Step 5
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [configDone, setConfigDone] = useState(false)
  const [agentTeam, setAgentTeam] = useState<AgentCard[]>([])
  const terminalRef = useRef<NodeJS.Timeout | null>(null)

  // ── Transitions ──────────────────────────────────────────────────────────

  function goTo(nextStep: number) {
    setVisible(false)
    setTimeout(() => {
      setStep(nextStep)
      setVisible(true)
    }, 220)
  }

  // ── Step 1 → 2 ───────────────────────────────────────────────────────────

  function handleStep1() {
    setIndustry(detectIndustry(businessDesc))
    goTo(2)
  }

  // ── Step 2 → 3 ───────────────────────────────────────────────────────────

  function handleStep2() {
    goTo(3)
  }

  // ── Step 3 → 4 ───────────────────────────────────────────────────────────

  function handleStep3() {
    goTo(4)
  }

  // ── Step 4 → 5 ───────────────────────────────────────────────────────────

  function handleStep4() {
    setAgentTeam(buildAgentTeam(workflows, tools))
    goTo(5)
  }

  // ── Terminal animation on step 5 ─────────────────────────────────────────

  useEffect(() => {
    if (step !== 5) return
    setTerminalLines([])
    setConfigDone(false)

    let i = 0
    function addLine() {
      if (i < TERMINAL_LINES.length) {
        setTerminalLines((prev) => [...prev, TERMINAL_LINES[i]])
        i++
        terminalRef.current = setTimeout(addLine, 700)
      } else {
        terminalRef.current = setTimeout(() => setConfigDone(true), 600)
      }
    }
    terminalRef.current = setTimeout(addLine, 400)

    return () => {
      if (terminalRef.current) clearTimeout(terminalRef.current)
    }
  }, [step])

  // ── Multi-select helpers ─────────────────────────────────────────────────

  function toggleWorkflow(item: string) {
    setWorkflows((prev) =>
      prev.includes(item)
        ? prev.filter((w) => w !== item)
        : prev.length < 3
        ? [...prev, item]
        : prev
    )
  }

  function toggleTool(item: string) {
    if (item === 'None of these') {
      setTools(['None of these'])
      return
    }
    setTools((prev) => {
      const filtered = prev.filter((t) => t !== 'None of these')
      return filtered.includes(item) ? filtered.filter((t) => t !== item) : [...filtered, item]
    })
  }

  // ── Progress bar ─────────────────────────────────────────────────────────

  const progress = ((step - 1) / 4) * 100

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-4 py-8 md:py-16">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10 md:mb-14 self-start md:self-center">
        <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold text-white tracking-tight">Space-Claw</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xl mb-8 md:mb-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600 font-medium">Step {Math.min(step, 5)} of 5</span>
          <span className="text-xs text-gray-700">{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step container */}
      <div
        className={clsx(
          'w-full max-w-xl transition-all duration-200',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        )}
      >
        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div>
            <div className="mb-8">
              <p className="text-xs text-brand-400 font-mono tracking-widest uppercase mb-3">Welcome</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                Hey. I&apos;m Space-Claw.
              </h1>
              <p className="text-gray-400 mt-2 text-base md:text-lg leading-relaxed">
                Before we set up your team, tell me about your business.
              </p>
            </div>
            <textarea
              autoFocus
              rows={4}
              value={businessDesc}
              onChange={(e) => setBusinessDesc(e.target.value)}
              placeholder="e.g. We run a Mexican e-commerce store selling handmade crafts..."
              className="w-full rounded-xl border border-gray-800 bg-gray-900 text-white placeholder-gray-600 text-sm md:text-base px-4 py-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent hover:border-gray-700 transition-colors"
            />
            <button
              onClick={handleStep1}
              disabled={businessDesc.trim().length < 10}
              className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm md:text-base"
            >
              Let&apos;s go <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <button onClick={() => goTo(1)} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="mb-8">
              <p className="text-xs text-brand-400 font-mono tracking-widest uppercase mb-3">Industry detected</p>
              <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-lg px-3 py-1.5 mb-4">
                <Zap className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-sm text-brand-300 font-medium">{industry}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                How big is the team?
              </h2>
              <p className="text-gray-400 mt-2 text-sm md:text-base">
                Human employees this will replace or assist.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['Just me', '2–5', '5–20', '20+'] as TeamSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setTeamSize(size)}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-all',
                    teamSize === size
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                  )}
                >
                  <div className={clsx(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                    teamSize === size ? 'border-brand-500 bg-brand-500' : 'border-gray-600'
                  )}>
                    {teamSize === size && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="font-medium text-sm md:text-base">{size}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleStep2}
              disabled={!teamSize}
              className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm md:text-base"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div>
            <button onClick={() => goTo(2)} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="mb-8">
              <p className="text-xs text-brand-400 font-mono tracking-widest uppercase mb-3">Workflows</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                What takes up most of your team&apos;s time?
              </h2>
              <p className="text-gray-400 mt-2 text-sm md:text-base">
                Pick up to 3 — these become your first agent workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                'Customer service',
                'Content creation',
                'Data analysis',
                'Sales outreach',
                'Email management',
                'Scheduling',
                'Research',
                'Social media',
                'Reporting',
                'Other',
              ].map((item) => {
                const selected = workflows.includes(item)
                const maxed = workflows.length >= 3 && !selected
                return (
                  <button
                    key={item}
                    onClick={() => toggleWorkflow(item)}
                    disabled={maxed}
                    className={clsx(
                      'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all',
                      selected
                        ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                        : maxed
                        ? 'border-gray-800 bg-gray-900/50 text-gray-700 cursor-not-allowed'
                        : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {item}
                  </button>
                )
              })}
            </div>
            {workflows.length > 0 && (
              <p className="mt-3 text-xs text-gray-600">{workflows.length}/3 selected</p>
            )}
            <button
              onClick={handleStep3}
              disabled={workflows.length === 0}
              className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm md:text-base"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 4 ── */}
        {step === 4 && (
          <div>
            <button onClick={() => goTo(3)} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="mb-8">
              <p className="text-xs text-brand-400 font-mono tracking-widest uppercase mb-3">Integrations</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                What tools are you already using?
              </h2>
              <p className="text-gray-400 mt-2 text-sm md:text-base">
                We&apos;ll pre-configure integrations for your team.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                'Gmail',
                'Slack',
                'Discord',
                'WhatsApp',
                'Notion',
                'Sheets/Excel',
                'Shopify',
                'HubSpot',
                'Zapier',
                'Linear',
                'GitHub',
                'Stripe',
                'None of these',
              ].map((item) => {
                const selected = tools.includes(item)
                return (
                  <button
                    key={item}
                    onClick={() => toggleTool(item)}
                    className={clsx(
                      'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all',
                      selected
                        ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                        : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {item}
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleStep4}
              className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors text-sm md:text-base"
            >
              Build my team <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 5 ── */}
        {step === 5 && (
          <div>
            {/* Terminal phase */}
            {!configDone && (
              <div>
                <div className="mb-6">
                  <p className="text-xs text-brand-400 font-mono tracking-widest uppercase mb-3">Configuring</p>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Configuring your agent team...
                  </h2>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 font-mono text-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    <span className="text-gray-600 text-xs ml-2">space-claw — agent-config</span>
                  </div>
                  <div className="space-y-2 min-h-[120px]">
                    {terminalLines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-brand-500">›</span>
                        <span className="text-gray-300">{line}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="text-brand-500">›</span>
                      <span className="w-2 h-4 bg-brand-500 animate-pulse rounded-sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results phase */}
            {configDone && (
              <div>
                <div className="mb-8">
                  <p className="text-xs text-brand-400 font-mono tracking-widest uppercase mb-3">Your team</p>
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                    Meet your agent team.
                  </h2>
                  <p className="text-gray-400 mt-2 text-sm md:text-base">
                    {agentTeam.length} agents configured and ready to deploy.
                  </p>
                </div>
                <div className="space-y-3 mb-8">
                  {agentTeam.map((agent, i) => (
                    <div
                      key={agent.name}
                      className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-xl transition-all hover:border-gray-700"
                      style={{
                        animationDelay: `${i * 80}ms`,
                        animation: 'slideIn 0.3s ease-out both',
                      }}
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand-600/20 border border-brand-600/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white">{agent.name}</span>
                          <TierBadge tier={agent.tier} />
                        </div>
                        <p className="text-xs text-gray-500 leading-snug">{agent.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors text-sm md:text-base shadow-lg shadow-brand-900/40"
                >
                  <Zap className="w-4 h-4" />
                  Launch your team →
                </button>
                <p className="text-center text-xs text-gray-700 mt-3">
                  You can edit and add agents anytime from your dashboard.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtle animation style */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
