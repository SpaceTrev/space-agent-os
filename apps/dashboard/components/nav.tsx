// apps/dashboard/components/nav.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  Radio,
  Store,
  Send,
  Menu,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react';

const navLinks = [
  { href: '/mission-control', label: 'Mission Control', icon: Radio },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/agents', label: 'Agents', icon: 'Users' },
    { href: '/dispatch', label: 'Dispatch', icon: Send },
];

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [connected] = useState(true); // future: real connection status

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left — Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
          >
            <Bot className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-semibold tracking-tight">
              Agent OS
            </span>
          </Link>

          {/* Center — Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-white/[0.06] text-indigo-400'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* Right — Status pill + mobile toggle */}
          <div className="flex items-center gap-3">
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
                connected
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {connected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {connected ? 'Connected' : 'Offline'}
            </span>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-out panel */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-64 border-l border-white/[0.06] bg-[#09090B]/95 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1 p-4">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-white/[0.06] text-indigo-400'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}

              {/* Mobile connection status */}
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    connected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {connected ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {connected ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
