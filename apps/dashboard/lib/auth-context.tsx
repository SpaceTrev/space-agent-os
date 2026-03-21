'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface AuthUser {
  id: string
  email: string
  name: string
}

interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  organization_id: string
  member_role: string
  organization?: {
    id: string
    name: string
    slug: string
    plan_id: string
  }
}

interface AuthContextValue {
  user: AuthUser | null
  workspaces: Workspace[]
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  workspaces: [],
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setWorkspaces(data.workspaces ?? [])
      } else {
        setUser(null)
        setWorkspaces([])
      }
    } catch {
      setUser(null)
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setWorkspaces([])
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ user, workspaces, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
