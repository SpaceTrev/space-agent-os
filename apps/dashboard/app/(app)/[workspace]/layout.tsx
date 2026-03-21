'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { clsx } from 'clsx'
import {
  Bot,
  Zap,
  Server,
  Brain,
  CreditCard,
  Settings,
  Users,
  GitBranch,
  MessageSquare,
  Smartphone,
  ChevronLeft,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

const navItems = [
  { label: 'Fleet', href: '', icon: Bot },
  { label: 'Agents', href: '/agents', icon: Users },
  { label: 'Tasks', href: '/tasks', icon: Zap },
  { label: 'Sprints', href: '/sprints', icon: GitBranch },
  { label: 'Sessions', href: '/sessions', icon: MessageSquare },
  { label: 'Remote', href: '/remote', icon: Smartphone },
  { label: 'Compute', href: '/compute', icon: Server },
  { label: 'Models', href: '/models', icon: Brain },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const workspace = params.workspace as string
  const { workspaces } = useAuth()

  const ws = workspaces.find((w) => w.slug === workspace)
  const displayName = ws?.name ?? workspace.replace(/-/g, ' ')

  const basePath = `/${workspace}`

  return (
    <div className="flex h-full">
      {/* Workspace sidebar */}
      <aside className="w-48 flex-shrink-0 flex flex-col bg-gray-900 light:bg-gray-50 border-r border-gray-800 light:border-gray-200">
        {/* Workspace header */}
        <div className="px-3 py-3 border-b border-gray-800 light:border-gray-200">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-gray-500 light:text-gray-600 hover:text-gray-300 light:hover:text-gray-800 transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All workspaces
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-700 light:bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-300 light:text-gray-700">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-white light:text-gray-900 truncate">
              {displayName}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const href = `${basePath}${item.href}`
            const isActive = item.href === ''
              ? pathname === basePath
              : pathname.startsWith(`${basePath}${item.href}`)
            const Icon = item.icon

            return (
              <Link
                key={item.label}
                href={href}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-gray-800 light:bg-gray-200 text-white light:text-gray-900 font-medium'
                    : 'text-gray-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-gray-800 light:hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {children}
      </div>
    </div>
  )
}
