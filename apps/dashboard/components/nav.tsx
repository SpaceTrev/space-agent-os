// apps/dashboard/components/nav.tsx
// The Intellectual Kinetic — Navigation
// Frosted Obsidian panel, no borders, no pills, dark/light toggle
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, Store, Send, Menu, X, Users, Sun, Moon, Wifi, WifiOff } from 'lucide-react';

const navLinks = [
  { href: '/mission-control', label: 'Mission Control', icon: Radio },
  { href: '/marketplace',     label: 'Marketplace',     icon: Store },
  { href: '/agents',          label: 'Agents',          icon: Users },
  { href: '/dispatch',        label: 'Dispatch',        icon: Send },
];

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="12" y1="10" x2="6"  y2="4"  />
      <line x1="12" y1="10" x2="18" y2="4"  />
      <line x1="12" y1="14" x2="4"  y2="20" />
      <line x1="12" y1="14" x2="20" y2="20" />
    </svg>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored === 'light' ? false : stored === 'dark' ? true : prefersDark;
    setIsDark(initial);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    const html = document.documentElement;
    if (next) {
      html.classList.add('dark');
      html.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--surface-container-high)] hover:bg-[var(--surface-bright)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors duration-150"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export default function Nav() {
  const pathname  = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [connected]                 = useState(true);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--surface-container-high)] [backdrop-filter:blur(12px)_saturate(180%)] [-webkit-backdrop-filter:blur(12px)_saturate(180%)] dark:[background-color:color-mix(in_srgb,var(--surface-container-high)_80%,transparent)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark className="h-5 w-5 text-[var(--primary)] group-hover:opacity-80 transition-opacity" />
            <span className="text-sm font-semibold tracking-tight text-[var(--on-surface)] group-hover:text-[var(--primary)] transition-colors" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Agent OS
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 md:flex">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-[var(--surface-container-highest)] text-[var(--primary)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)] hover:text-[var(--on-surface)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
              connected
                ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]'
                : 'text-[var(--on-surface-variant)] opacity-60'
            }`}>
              {connected
                ? <><Wifi className="h-3 w-3 text-[var(--primary)]" /><span>Live</span></>
                : <><WifiOff className="h-3 w-3" /><span>Offline</span></>
              }
            </span>

            <ThemeToggle />

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)] hover:text-[var(--on-surface)] transition-colors md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--surface)]/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-64 bg-[var(--surface-container-high)] [backdrop-filter:blur(12px)] md:hidden">
            <div className="flex flex-col gap-1 p-4">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[var(--surface-container-highest)] text-[var(--primary)]'
                        : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)] hover:text-[var(--on-surface)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
              <div className="mt-4 pt-4">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
