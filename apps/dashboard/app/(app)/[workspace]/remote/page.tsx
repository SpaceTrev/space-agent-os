'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Smartphone,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Mic,
  MessageSquare,
  Zap,
} from 'lucide-react'

// ============================================================
// Remote Control — WhatsApp configuration & recent tasks
// ============================================================

export default function RemotePage() {
  const params = useParams()
  const workspace = params.workspace as string
  const [copied, setCopied] = useState(false)

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/whatsapp`
      : '/api/webhooks/whatsapp'

  // Check env vars (client-side hint — actual check is server-side)
  const envVars = [
    { name: 'TWILIO_ACCOUNT_SID', hint: 'Twilio Account SID' },
    { name: 'TWILIO_AUTH_TOKEN', hint: 'Twilio Auth Token' },
    { name: 'TWILIO_WHATSAPP_NUMBER', hint: 'WhatsApp sender number' },
    { name: 'OPENAI_API_KEY', hint: 'For voice note transcription (optional)' },
  ]

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white light:text-gray-900">
            Remote Control
          </h1>
          <p className="text-sm text-gray-400 light:text-gray-600">
            Command your agents from WhatsApp — text or voice notes
          </p>
        </div>
      </div>

      {/* Setup section */}
      <div className="space-y-6">
        {/* Webhook URL */}
        <section className="bg-gray-900 light:bg-white border border-gray-800 light:border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Webhook URL
          </h2>
          <p className="text-xs text-gray-400 light:text-gray-600 mb-3">
            Paste this URL into your Twilio WhatsApp Sandbox &quot;When a
            message comes in&quot; field.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-800 light:bg-gray-100 rounded-lg text-sm text-green-400 light:text-green-700 font-mono truncate">
              {webhookUrl}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-gray-800 light:bg-gray-100 hover:bg-gray-700 light:hover:bg-gray-200 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400 light:text-gray-600" />
              )}
            </button>
          </div>
        </section>

        {/* Environment variables */}
        <section className="bg-gray-900 light:bg-white border border-gray-800 light:border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Required Environment Variables
          </h2>
          <div className="space-y-2">
            {envVars.map((v) => (
              <div
                key={v.name}
                className="flex items-center justify-between px-3 py-2 bg-gray-800 light:bg-gray-50 rounded-lg"
              >
                <div>
                  <code className="text-sm text-gray-200 light:text-gray-800 font-mono">
                    {v.name}
                  </code>
                  <span className="ml-2 text-xs text-gray-500">{v.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Commands reference */}
        <section className="bg-gray-900 light:bg-white border border-gray-800 light:border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Available Commands
          </h2>
          <div className="space-y-3">
            <CommandRow
              icon={Zap}
              command={`/run ${workspace} <agent> <task>`}
              description="Queue a task for an agent in this workspace"
            />
            <CommandRow
              icon={MessageSquare}
              command={`/status ${workspace}`}
              description="View running/queued task counts"
            />
            <CommandRow
              icon={Mic}
              command="🎤 Voice note"
              description="Send a voice note — it's transcribed and parsed as a command"
            />
          </div>
        </section>

        {/* Quick start */}
        <section className="bg-gray-900 light:bg-white border border-gray-800 light:border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white light:text-gray-900 mb-3">
            Quick Start
          </h2>
          <ol className="space-y-2 text-sm text-gray-300 light:text-gray-700 list-decimal list-inside">
            <li>Create a free Twilio account and enable the WhatsApp Sandbox</li>
            <li>
              Set the &quot;When a message comes in&quot; webhook to the URL
              above
            </li>
            <li>
              Add{' '}
              <code className="px-1.5 py-0.5 bg-gray-800 light:bg-gray-100 rounded text-xs font-mono">
                TWILIO_ACCOUNT_SID
              </code>{' '}
              and{' '}
              <code className="px-1.5 py-0.5 bg-gray-800 light:bg-gray-100 rounded text-xs font-mono">
                TWILIO_AUTH_TOKEN
              </code>{' '}
              to your environment
            </li>
            <li>
              Send{' '}
              <code className="px-1.5 py-0.5 bg-gray-800 light:bg-gray-100 rounded text-xs font-mono">
                /help
              </code>{' '}
              from WhatsApp to verify everything works
            </li>
          </ol>
        </section>
      </div>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function CommandRow({
  icon: Icon,
  command,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  command: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 bg-gray-800 light:bg-gray-50 rounded-lg">
      <Icon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
      <div>
        <code className="text-sm text-gray-200 light:text-gray-800 font-mono">
          {command}
        </code>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}
