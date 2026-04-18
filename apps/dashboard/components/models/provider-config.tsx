'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '../shared/button'
import { Input } from '../shared/input'
import { Badge } from '../shared/badge'
import type { ModelProviderType } from '../../lib/types'

interface ProviderConfigProps {
  providerId?: string
  providerType: ModelProviderType
  displayName: string
  logoChar?: string
  isActive: boolean
  isVerified: boolean
  hasApiKey: boolean
  defaultModel?: string
  availableModels?: { id: string; name: string; isFree?: boolean }[]
  docsUrl?: string
  onSave: (data: { apiKey?: string; defaultModel?: string; isActive: boolean }) => Promise<void>
}

const providerColors: Record<ModelProviderType, string> = {
  anthropic: 'text-orange-400',
  gemini: 'text-blue-400',
  perplexity: 'text-purple-400',
  groq: 'text-green-400',
  mistral: 'text-yellow-400',
  openrouter: 'text-pink-400',
  ollama: 'text-on-surface-variant',
}

export function ProviderConfig({
  providerType,
  displayName,
  logoChar,
  isActive,
  isVerified,
  hasApiKey,
  defaultModel = '',
  availableModels = [],
  docsUrl,
  onSave,
}: ProviderConfigProps) {
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState(defaultModel)
  const [active, setActive] = useState(isActive)
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!isVerified)

  const colorClass = providerColors[providerType] || 'text-on-surface-variant'

  const handleSave = async () => {
    setError(null)
    setLoading(true)
    try {
      await onSave({
        apiKey: apiKey || undefined,
        defaultModel: selectedModel || undefined,
        isActive: active,
      })
      setSaved(true)
      setApiKey('')
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-high border border-outline-variant rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-base transition-colors text-left"
      >
        <div className={clsx('w-9 h-9 rounded-lg bg-surface-highest flex items-center justify-center text-sm font-bold', colorClass)}>
          {logoChar || displayName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{displayName}</p>
            {isVerified ? (
              <Badge variant="green" size="sm" dot>Connected</Badge>
            ) : hasApiKey ? (
              <Badge variant="yellow" size="sm">Pending</Badge>
            ) : (
              <Badge variant="gray" size="sm">Not configured</Badge>
            )}
          </div>
          {defaultModel && (
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">Default: {defaultModel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active toggle */}
          <div
            role="switch"
            aria-checked={active}
            onClick={(e) => {
              e.stopPropagation()
              setActive((v) => !v)
            }}
            className={clsx(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer',
              active ? 'bg-brand-600' : 'bg-surface-highest'
            )}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                active ? 'translate-x-4.5' : 'translate-x-0.5'
              )}
            />
          </div>
          <div className={clsx('transition-transform', expanded ? 'rotate-180' : '')}>
            <svg className="w-4 h-4 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-outline-variant pt-4 flex flex-col gap-4">
          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-on-surface">
                API Key {hasApiKey && <span className="text-green-400 text-xs ml-1">(saved)</span>}
              </label>
              {docsUrl && (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                >
                  <ExternalLink className="w-3 h-3" />
                  Get API key
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? '••••••••••••••••' : 'sk-...'}
                className={clsx(
                  'block w-full rounded-lg border bg-surface-base text-sm text-white placeholder-on-surface-variant/50',
                  'border-outline-variant hover:border-primary/50',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                  'px-3 py-2 pr-10'
                )}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Default model */}
          {availableModels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Default Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={clsx(
                  'block w-full rounded-lg border bg-surface-base text-sm text-white',
                  'border-outline-variant hover:border-primary/50',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                  'px-3 py-2'
                )}
              >
                <option value="">Select a model...</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.isFree ? ' (Free)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={loading}
            >
              {saved ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : 'Save Configuration'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
