'use client'

import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, Search, Zap, DollarSign } from 'lucide-react'
import { Badge } from '../shared/badge'
import type { ModelProviderType } from '../../lib/types'

interface ModelOption {
  id: string
  name: string
  provider: ModelProviderType
  providerName: string
  contextWindow?: number
  isFree: boolean
  inputCostPerMillion?: number
}

interface ModelPickerProps {
  value?: string
  onChange: (modelId: string) => void
  models: ModelOption[]
  label?: string
  disabled?: boolean
  placeholder?: string
}

export function ModelPicker({
  value,
  onChange,
  models,
  label = 'Model',
  disabled,
  placeholder = 'Select a model...',
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = models.find((m) => m.id === value)

  const filtered = models.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.providerName.toLowerCase().includes(search.toLowerCase())
  )

  // Group by provider
  const grouped = filtered.reduce<Record<string, ModelOption[]>>((acc, m) => {
    if (!acc[m.providerName]) acc[m.providerName] = []
    acc[m.providerName].push(m)
    return acc
  }, {})

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--on-surface)] mb-1.5">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
          'bg-[var(--surface-container-highest)] text-left',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white truncate">{selected.name}</span>
            <span className="text-on-surface-variant text-xs flex-shrink-0">{selected.providerName}</span>
            {selected.isFree ? (
              <Badge variant="green" size="sm">Free</Badge>
            ) : (
              <Badge variant="gray" size="sm">Paid</Badge>
            )}
          </div>
        ) : (
          <span className="text-on-surface-variant">{placeholder}</span>
        )}
        <ChevronDown className={clsx('w-4 h-4 text-on-surface-variant flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--surface-container-highest)] [backdrop-filter:blur(10px)] rounded-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 mb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-container)] rounded-lg text-sm text-white placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {Object.keys(grouped).length === 0 ? (
              <p className="px-4 py-6 text-sm text-on-surface-variant text-center">No models found</p>
            ) : (
              Object.entries(grouped).map(([providerName, providerModels]) => (
                <div key={providerName}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider bg-surface-high/80">
                    {providerName}
                  </div>
                  {providerModels.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onChange(model.id)
                        setOpen(false)
                        setSearch('')
                      }}
                      className={clsx(
                        'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-[var(--surface-container-high)] transition-colors text-left',
                        model.id === value && 'bg-[var(--surface-container-high)]'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-on-surface truncate">{model.name}</span>
                        {model.contextWindow && (
                          <span className="text-[10px] text-on-surface-variant flex-shrink-0">
                            {model.contextWindow >= 1000 ? `${Math.round(model.contextWindow / 1000)}K ctx` : `${model.contextWindow} ctx`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {model.isFree ? (
                          <Badge variant="green" size="sm">
                            <Zap className="w-2.5 h-2.5" />
                            Free
                          </Badge>
                        ) : model.inputCostPerMillion != null ? (
                          <span className="text-xs text-on-surface-variant font-mono">
                            ${model.inputCostPerMillion.toFixed(2)}/1M
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
