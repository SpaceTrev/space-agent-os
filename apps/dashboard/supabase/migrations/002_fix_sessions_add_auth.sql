-- ============================================================
-- Agent OS — Migration 002: Fix sessions table + add columns
-- The sessions runner (lib/sessions.ts) uses columns that
-- weren't in the original schema. This migration adds them.
-- ============================================================

-- Add missing columns to sessions table that lib/sessions.ts expects
ALTER TABLE sessions ALTER COLUMN agent_id DROP NOT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS transcript JSONB NOT NULL DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_tokens BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 8) NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add api_cost_this_month to workspaces (used by runner.ts and billing webhook)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS api_cost_this_month NUMERIC(12, 8) NOT NULL DEFAULT 0;

-- Add agent stats columns (used by runner.ts)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_tasks_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_tokens_used BIGINT NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 8) NOT NULL DEFAULT 0;

-- Add metadata column to agents (used by skills.ts)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_type ON sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_sessions_sprint_id ON sessions(sprint_id);
