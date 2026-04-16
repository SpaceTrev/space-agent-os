import Link from 'next/link'
import { CheckCircle2, ArrowRight, Bot } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    price: 29,
    description: 'Perfect for small teams and solo developers exploring AI automation.',
    color: 'border-gray-700',
    badgeColor: 'bg-gray-700 text-gray-300',
    ctaVariant: 'outline',
    features: [
      '5 agents',
      '500 tasks / month',
      'Shared compute',
      '3 model providers',
      'Basic analytics',
      'Community support',
    ],
    limits: {
      agents: 5,
      tasks: 500,
      members: 3,
      computeHours: 5,
    },
    cta: 'Start with Starter',
    href: '/signup?plan=starter',
  },
  {
    name: 'Pro',
    price: 99,
    description: 'For growing teams that need more power and flexibility.',
    color: 'border-brand-500 ring-2 ring-brand-500/20',
    badgeColor: 'bg-brand-600 text-white',
    ctaVariant: 'primary',
    popular: true,
    features: [
      '20 agents',
      '2,000 tasks / month',
      '10h compute included',
      'All model providers',
      'Sprint management',
      'Approval workflows',
      'Real-time log streaming',
      'Priority support',
    ],
    limits: {
      agents: 20,
      tasks: 2000,
      members: 10,
      computeHours: 10,
    },
    cta: 'Start with Pro',
    href: '/signup?plan=pro',
  },
  {
    name: 'Enterprise',
    price: 299,
    description: 'Unlimited scale, dedicated infrastructure, and white-label options.',
    color: 'border-gray-700',
    badgeColor: 'bg-gray-700 text-gray-300',
    ctaVariant: 'outline',
    features: [
      'Unlimited agents',
      'Unlimited tasks',
      'Dedicated compute servers',
      'White-label branding',
      'SSO / SAML',
      'Audit logs',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated success manager',
    ],
    limits: {
      agents: -1,
      tasks: -1,
      members: -1,
      computeHours: -1,
    },
    cta: 'Contact Sales',
    href: 'mailto:sales@agentos.io',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Agent OS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Start free and scale as your team grows. No surprise fees.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-gray-900 border rounded-2xl p-6 flex flex-col ${plan.color}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-brand-600 text-white text-xs font-semibold rounded-sm">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <span className={`inline-block px-2.5 py-0.5 rounded-sm text-xs font-semibold mb-3 ${plan.badgeColor}`}>
                  {plan.name}
                </span>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-gray-500 text-sm">/mo</span>
                </div>
                <p className="text-sm text-gray-400">{plan.description}</p>
              </div>

              {/* Limits summary */}
              <div className="grid grid-cols-2 gap-2 mb-6 p-3 bg-gray-800 rounded-xl">
                {[
                  { label: 'Agents', value: plan.limits.agents === -1 ? '∞' : plan.limits.agents },
                  { label: 'Tasks/mo', value: plan.limits.tasks === -1 ? '∞' : plan.limits.tasks.toLocaleString() },
                  { label: 'Members', value: plan.limits.members === -1 ? '∞' : plan.limits.members },
                  { label: 'Compute hrs', value: plan.limits.computeHours === -1 ? '∞' : plan.limits.computeHours },
                ].map((limit) => (
                  <div key={limit.label} className="text-center">
                    <div className="text-lg font-bold text-white">{limit.value}</div>
                    <div className="text-xs text-gray-500">{limit.label}</div>
                  </div>
                ))}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  plan.ctaVariant === 'primary'
                    ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/30'
                    : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-white'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: 'Can I use my own AI provider API keys?',
                a: 'Yes! Starter and above allow you to add your own keys for Anthropic, OpenAI, Google, Groq, Mistral, and more. Your keys, your costs.',
              },
              {
                q: 'What counts as a "task"?',
                a: 'A task is one unit of work dispatched to an agent. It may involve multiple LLM calls internally, but it counts as one task for billing purposes.',
              },
              {
                q: 'What is compute?',
                a: 'Compute hours are for dedicated server instances where your agents run. Shared compute is included on all plans for lighter workloads.',
              },
              {
                q: 'Can I upgrade or downgrade anytime?',
                a: 'Yes. Changes take effect immediately and are prorated on your next invoice.',
              },
            ].map((item) => (
              <div key={item.q} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-2">{item.q}</h3>
                <p className="text-sm text-gray-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-400 transition-colors">Back to home</Link>
          {' '}&middot;{' '}
          <Link href="/signup" className="hover:text-gray-400 transition-colors">Sign up</Link>
        </div>
      </footer>
    </div>
  )
}
