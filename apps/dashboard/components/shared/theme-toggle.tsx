'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.remove('dark')
    root.classList.add('light')
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme') as Theme | null
    const resolved = stored ?? getSystemTheme()
    setTheme(resolved)
    applyTheme(resolved)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    applyTheme(next)
  }

  if (!mounted) {
    return <button className="p-2 rounded-md w-8 h-8" aria-label="Toggle theme" disabled />
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-surface-low transition-colors text-on-surface-variant hover:text-on-surface"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Solarized Light' : 'Deep Navy'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  )
}
