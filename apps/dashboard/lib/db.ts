import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ============================================================
// Environment validation
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  // Throws moved to lazy evaluation inside functions

// ============================================================
// Browser (client-side) Supabase client
// Singleton pattern — safe to call from any client component.
// ============================================================

let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowserClient(): any {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase public env vars')
  if (browserClient) return browserClient
  browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return browserClient
}

// ============================================================
// Server-side Supabase client (uses cookies for auth)
// Must be called inside a Server Component or Route Handler.
// ============================================================

export async function getSupabaseServerClient(): Promise<any> {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase public env vars')
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Same as above
        }
      },
    },
  })
}

// ============================================================
// Service-role admin client — bypasses RLS
// Only for server-side use in trusted contexts (webhooks, jobs)
// ============================================================

let adminClient: ReturnType<typeof createClient> | null = null

export function getSupabaseAdminClient(): any {
  if (!supabaseServiceKey) {
    throw new Error('Missing env var: SUPABASE_SERVICE_KEY — admin client unavailable')
  }
  if (adminClient) return adminClient
  adminClient = createClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return adminClient
}

// ============================================================
// Helper: get the currently authenticated user (server-side)
// Returns null if not authenticated.
// ============================================================

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ============================================================
// Helper: require authentication — throws if not logged in
// ============================================================

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized: authentication required')
  }
  return user
}

// ============================================================
// Helper: get workspace with membership check
// ============================================================

export async function getWorkspaceWithAccess(
  workspaceId: string,
  userId: string
) {
  const supabase = await getSupabaseServerClient()

  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(*)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !membership) {
    throw new Error('Forbidden: you do not have access to this workspace')
  }

  return {
    workspace: (membership as { role: string; workspace: unknown }).workspace,
    role: membership.role,
  }
}

// ============================================================
// Helper: paginate a Supabase query
// ============================================================

export function applyPagination<T extends { range: (from: number, to: number) => T }>(
  query: T,
  page = 1,
  perPage = 25
): T {
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  return query.range(from, to)
}

// ============================================================
// Helper: simple upsert wrapper with error handling
// ============================================================

export async function safeUpsert<T extends object>(
  table: string,
  data: T,
  onConflict?: string
) {
  const supabase = getSupabaseAdminClient()
  const query = supabase.from(table).upsert(data, {
    onConflict: onConflict,
  })
  const { data: result, error } = await query.select()
  if (error) throw error
  return result
}

// ============================================================
// Re-export the raw createClient for direct usage
// ============================================================

export { createClient }
