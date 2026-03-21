// ============================================================
// Agent OS — Auth Helpers
// Server-side authentication and authorization utilities
// ============================================================

import { NextRequest } from 'next/server'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/db'
import type { WorkspaceRole } from '@/lib/types'

// ============================================================
// Auth Errors
// ============================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

// ============================================================
// getCurrentUser — gets the authenticated user from Supabase
// Returns null if not authenticated
// ============================================================

export async function getCurrentUser(request?: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// ============================================================
// requireAuth — throws AuthError if not authenticated
// ============================================================

export async function requireAuth(request?: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    throw new AuthError('Unauthorized: authentication required', 401)
  }
  return user
}

// ============================================================
// getCurrentWorkspace — gets workspace if user has access
// Returns { workspace, role } or throws
// ============================================================

export async function getCurrentWorkspace(slug: string, userId: string) {
  const supabase = await getSupabaseServerClient()

  // Fetch workspace by slug
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .single()

  if (wsError || !workspace) {
    throw new AuthError('Workspace not found', 404)
  }

  // Check membership
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)
    .single()

  if (memberError || !membership) {
    throw new ForbiddenError('You do not have access to this workspace')
  }

  return { workspace, role: membership.role as WorkspaceRole }
}

// ============================================================
// Role hierarchy for permission checks
// ============================================================

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 0,
  developer: 1,
  admin: 2,
  owner: 3,
}

// ============================================================
// requireWorkspaceAccess — checks that user has at least minRole
// ============================================================

export async function requireWorkspaceAccess(
  workspaceSlug: string,
  userId: string,
  minRole: WorkspaceRole = 'viewer'
) {
  const { workspace, role } = await getCurrentWorkspace(workspaceSlug, userId)

  const userLevel = ROLE_HIERARCHY[role] ?? -1
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0

  if (userLevel < requiredLevel) {
    throw new ForbiddenError(
      `This action requires the "${minRole}" role or higher. Your role: "${role}"`
    )
  }

  return { workspace, role }
}

// ============================================================
// requireWorkspaceAccessById — same but by workspace ID
// ============================================================

export async function requireWorkspaceAccessById(
  workspaceId: string,
  userId: string,
  minRole: WorkspaceRole = 'viewer'
) {
  const supabase = await getSupabaseServerClient()

  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(*)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !membership) {
    throw new ForbiddenError('You do not have access to this workspace')
  }

  const role = membership.role as WorkspaceRole
  const userLevel = ROLE_HIERARCHY[role] ?? -1
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0

  if (userLevel < requiredLevel) {
    throw new ForbiddenError(
      `This action requires the "${minRole}" role or higher. Your role: "${role}"`
    )
  }

  return {
    workspace: (membership as { role: string; workspace: unknown }).workspace,
    role,
  }
}

// ============================================================
// Helper: parse error into a response-friendly object
// ============================================================

export function toErrorResponse(error: unknown): { message: string; statusCode: number } {
  if (error instanceof AuthError) {
    return { message: error.message, statusCode: error.statusCode }
  }
  if (error instanceof ForbiddenError) {
    return { message: error.message, statusCode: 403 }
  }
  if (error instanceof Error) {
    return { message: error.message, statusCode: 500 }
  }
  return { message: 'An unexpected error occurred', statusCode: 500 }
}

// ============================================================
// Helper: extract Bearer token from Authorization header
// ============================================================

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}
