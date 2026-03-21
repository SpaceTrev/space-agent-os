// ============================================================
// GET /api/sessions/[id]  — get session with messages
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/db'
import { requireAuth, toErrorResponse } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req)
    const { id } = await params

    const supabase = await getSupabaseServerClient()

    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !session) {
      // Seed fallback for demo purposes
      const now = Date.now()
      const seedSession = {
        id,
        workspace_id: 'demo',
        session_type: 'planning',
        sprint_id: 'sprint-002',
        status: 'completed',
        participants: ['agent-001', 'agent-002', 'agent-003'],
        context: { goal: 'Plan Sprint 2 tasks and assign owners' },
        started_at: new Date(now - 8 * 24 * 3600000).toISOString(),
        ended_at: new Date(now - 8 * 24 * 3600000 + 1800000).toISOString(),
        created_by: 'seed',
        created_at: new Date(now - 8 * 24 * 3600000).toISOString(),
        updated_at: new Date(now - 8 * 24 * 3600000 + 1800000).toISOString(),
      }
      const seedMessages = [
        { id: 'msg-1', session_id: id, role: 'user', content: 'Let\'s plan Sprint 2. We need to finish the sessions page, wire billing to real API, fix model selection in agent creation, and add seed data to all API routes.', created_at: new Date(now - 8 * 24 * 3600000 + 60000).toISOString() },
        { id: 'msg-2', session_id: id, role: 'assistant', content: 'Understood. I\'ll coordinate task breakdown. Research Agent can handle the sessions UI. Code Agent takes billing and model wiring. I\'ll oversee seed data implementation across all routes.', created_at: new Date(now - 8 * 24 * 3600000 + 120000).toISOString() },
        { id: 'msg-3', session_id: id, role: 'assistant', content: 'Task assignments confirmed:\n- Sessions page (list + detail): Research Agent\n- Billing API wiring: Code Agent\n- Model picker fix: Code Agent\n- Seed data: Orchestrator\n\nEstimated completion: 2 hours.', created_at: new Date(now - 8 * 24 * 3600000 + 300000).toISOString() },
        { id: 'msg-4', session_id: id, role: 'user', content: 'Looks good. Proceed.', created_at: new Date(now - 8 * 24 * 3600000 + 360000).toISOString() },
        { id: 'msg-5', session_id: id, role: 'assistant', content: 'Sprint 2 planning complete. All tasks created and queued. Sprint runs from now through next week.', created_at: new Date(now - 8 * 24 * 3600000 + 1800000).toISOString() },
      ]
      return NextResponse.json({ session: seedSession, messages: seedMessages })
    }

    // Fetch messages for this session
    const { data: messages } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ session, messages: messages ?? [] })
  } catch (err) {
    const { message, statusCode } = toErrorResponse(err)
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
