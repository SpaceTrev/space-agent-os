// ============================================================
// Marketplace — Public Layout (no auth required)
// ============================================================

import type { Metadata } from 'next'
import Link from 'next/link'
import { Bot } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Automation Marketplace',
  description:
    'Browse and install agent templates, skills, automations, and integrations for Agent OS.',
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border-base bg-surface/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Agent OS</span>
            <span className="text-text-muted mx-1">/</span>
            <span className="text-sm text-text-secondary">Marketplace</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm px-3.5 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-brand-600 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
