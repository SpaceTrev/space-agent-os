'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  Bot,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Plus,
  User,
  Terminal,
  Globe,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ThemeToggle } from '@/components/shared/theme-toggle'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, workspaces, loading, logout } = useAuth()
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const orgName = (workspaces[0]?.organization as { name?: string } | undefined)?.name ?? 'Agent OS'

  if (loading) {
    return (
      <div className="flex h-screen bg-background text-text-primary items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-surface border-r border-border-base">
        {/* Logo / Org */}
        <div className="px-4 py-4 border-b border-border-base">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{orgName}</p>
              <p className="text-[10px] text-text-muted">Agent OS</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/dashboard'
                ? 'bg-border-base text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-border-base'
            )}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Dashboard
          </Link>

          {/* Marketplace */}
          <Link
            href="/marketplace"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/marketplace'
                ? 'bg-border-base text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-border-base'
            )}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            Marketplace
          </Link>

          {/* Mission Control */}
          <Link
            href="/mission-control"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === '/mission-control'
                ? 'bg-border-base text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-border-base'
            )}
          >
            <Terminal className="w-4 h-4 flex-shrink-0" />
            Mission Control
          </Link>

          {/* Workspaces section */}
          <div className="pt-4">
            <button
              onClick={() => setWorkspacesExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
            >
              Workspaces
              {workspacesExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {workspacesExpanded && (
              <div className="mt-1 space-y-0.5">
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={`/${ws.slug}`}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group',
                      pathname.startsWith(`/${ws.slug}`)
                        ? 'bg-border-base text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-border-base'
                    )}
                  >
                    <div className="w-5 h-5 rounded bg-border-base flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-text-secondary">
                      {ws.name[0]}
                    </div>
                    <span className="flex-1 truncate">{ws.name}</span>
                    {ws.status === 'active' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    )}
                  </Link>
                ))}

                <Link
                  href="/dashboard"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-border-base transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New workspace
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* User menu */}
        <div className="px-2 py-3 border-t border-border-base">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-border-base transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white">
                  {user?.name?.charAt(0) ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-text-secondary truncate">{user?.name ?? 'User'}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border-base rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-border-base">
                  <p className="text-xs text-text-secondary truncate">{user?.email ?? ''}</p>
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border-base">
                  <span className="text-xs text-text-secondary">Theme</span>
                  <ThemeToggle />
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-border-base transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-border-base transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-12 flex items-center px-6 border-b border-border-base bg-surface flex-shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">{orgName}</span>
            <div className="w-px h-4 bg-border-base" />
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <User className="w-3.5 h-3.5" />
              {user?.name ?? 'User'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
