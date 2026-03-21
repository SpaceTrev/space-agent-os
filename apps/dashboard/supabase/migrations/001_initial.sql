-- ============================================================
-- Agent OS — Initial Database Schema
-- Migration: 001_initial
-- ============================================================
-- Multi-tenant AI agent orchestration platform
-- Row-Level Security (RLS) enforces workspace isolation
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE workspace_status AS ENUM ('active', 'paused', 'archived');
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'developer', 'viewer');
CREATE TYPE model_provider_type AS ENUM (
  'anthropic', 'gemini', 'perplexity', 'groq', 'mistral', 'openrouter', 'ollama'
);
CREATE TYPE agent_status AS ENUM ('idle', 'running', 'paused', 'error', 'archived');
CREATE TYPE agent_type AS ENUM ('worker', 'orchestrator', 'specialist', 'reviewer');
CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'paused', 'completed', 'canceled');
CREATE TYPE task_status AS ENUM (
  'pending', 'queued', 'running', 'completed', 'failed', 'canceled', 'retrying'
);
CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE task_log_level AS ENUM ('debug', 'info', 'warn', 'error');
CREATE TYPE task_log_type AS ENUM (
  'system', 'llm_call', 'tool_call', 'tool_result',
  'agent_thought', 'agent_action', 'retry', 'error'
);
CREATE TYPE session_status AS ENUM ('active', 'idle', 'ended');
CREATE TYPE session_type AS ENUM ('user_agent', 'agent_agent', 'debug');
CREATE TYPE compute_provider AS ENUM ('railway', 'fly', 'custom');
CREATE TYPE compute_server_status AS ENUM (
  'provisioning', 'running', 'stopping', 'stopped', 'error'
);
CREATE TYPE usage_event_type AS ENUM (
  'llm_tokens', 'compute_seconds', 'storage_gb_hour', 'api_request', 'tool_execution'
);
CREATE TYPE subscription_status AS ENUM (
  'active', 'trialing', 'past_due', 'canceled', 'unpaid'
);

-- ============================================================
-- PLANS TABLE
-- ============================================================

CREATE TABLE plans (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      TEXT NOT NULL,
  tier                      plan_tier NOT NULL UNIQUE,
  price_monthly             NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_yearly              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stripe_price_id_monthly   TEXT,
  stripe_price_id_yearly    TEXT,
  max_agents                INTEGER NOT NULL DEFAULT 3,
  max_concurrent_tasks      INTEGER NOT NULL DEFAULT 5,
  max_members               INTEGER NOT NULL DEFAULT 3,
  compute_hours_included    INTEGER NOT NULL DEFAULT 10,
  token_budget_millions     INTEGER NOT NULL DEFAULT 10,
  custom_providers          BOOLEAN NOT NULL DEFAULT FALSE,
  dedicated_compute         BOOLEAN NOT NULL DEFAULT FALSE,
  departments_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  features                  TEXT[] NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (name, tier, price_monthly, price_yearly, max_agents, max_concurrent_tasks, max_members, compute_hours_included, token_budget_millions, custom_providers, dedicated_compute, departments_enabled, features)
VALUES
  ('Free',       'free',       0,     0,      3,   5,   3,   10,   10,   FALSE, FALSE, FALSE, ARRAY['3 agents', '5 concurrent tasks', '10M tokens/mo', 'Community support']),
  ('Starter',    'starter',    29,    290,    10,  20,  10,  50,   100,  TRUE,  FALSE, FALSE, ARRAY['10 agents', '20 concurrent tasks', '100M tokens/mo', 'Custom API keys', 'Email support']),
  ('Pro',        'pro',        99,    990,    50,  100, 25,  200,  500,  TRUE,  TRUE,  TRUE,  ARRAY['50 agents', '100 concurrent tasks', '500M tokens/mo', 'Dedicated compute', 'Departments', 'Priority support']),
  ('Enterprise', 'enterprise', 499,   4990,   -1,  -1,  -1,  -1,   -1,   TRUE,  TRUE,  TRUE,  ARRAY['Unlimited agents', 'Unlimited tasks', 'Unlimited tokens', 'SLA guarantee', 'Dedicated support', 'Custom contracts']);

-- ============================================================
-- ORGANIZATIONS TABLE (top-level tenant)
-- ============================================================

CREATE TABLE organizations (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    TEXT NOT NULL,
  slug                    TEXT NOT NULL UNIQUE,
  logo_url                TEXT,
  plan_id                 UUID NOT NULL REFERENCES plans(id),
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  subscription_status     subscription_status,
  billing_email           TEXT,
  billing_cycle           TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  trial_ends_at           TIMESTAMPTZ,
  owner_id                UUID NOT NULL,  -- references auth.users(id)
  settings                JSONB NOT NULL DEFAULT '{
    "allow_member_invites": true,
    "default_model_provider": "gemini",
    "enforce_sso": false,
    "audit_log_retention_days": 90,
    "allowed_domains": []
  }',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);

-- ============================================================
-- DEPARTMENTS TABLE
-- ============================================================

CREATE TABLE departments (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                            TEXT NOT NULL,
  description                     TEXT,
  head_user_id                    UUID,  -- references auth.users(id)
  budget_tokens_monthly           BIGINT,
  budget_compute_hours_monthly    INTEGER,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

CREATE INDEX idx_departments_organization_id ON departments(organization_id);

-- ============================================================
-- WORKSPACES TABLE
-- ============================================================

CREATE TABLE workspaces (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  status           workspace_status NOT NULL DEFAULT 'active',
  department_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
  settings         JSONB NOT NULL DEFAULT '{
    "default_agent_model": "gemini:gemini-2.0-flash-exp",
    "max_task_retries": 3,
    "task_timeout_seconds": 300,
    "enable_agent_memory": true,
    "memory_retention_days": 30,
    "auto_pause_on_budget_exhaustion": true,
    "notification_channels": []
  }',
  model_config     JSONB NOT NULL DEFAULT '{
    "providers": {},
    "default_provider": "gemini",
    "default_model": "gemini-2.0-flash-exp",
    "fallback_model": null
  }',
  created_by       UUID NOT NULL,  -- references auth.users(id)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_workspaces_organization_id ON workspaces(organization_id);
CREATE INDEX idx_workspaces_department_id ON workspaces(department_id);
CREATE INDEX idx_workspaces_status ON workspaces(status);

-- ============================================================
-- WORKSPACE MEMBERS TABLE
-- ============================================================

CREATE TABLE workspace_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,  -- references auth.users(id)
  role          workspace_role NOT NULL DEFAULT 'developer',
  invited_by    UUID,  -- references auth.users(id)
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- ============================================================
-- MODEL PROVIDERS TABLE
-- ============================================================

CREATE TABLE model_providers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type     model_provider_type NOT NULL,
  display_name      TEXT NOT NULL,
  encrypted_api_key TEXT,
  iv                TEXT,
  base_url          TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  available_models  JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, provider_type)
);

CREATE INDEX idx_model_providers_workspace_id ON model_providers(workspace_id);
CREATE INDEX idx_model_providers_provider_type ON model_providers(provider_type);

-- ============================================================
-- AGENTS TABLE
-- ============================================================

CREATE TABLE agents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  type             agent_type NOT NULL DEFAULT 'worker',
  status           agent_status NOT NULL DEFAULT 'idle',
  system_prompt    TEXT NOT NULL DEFAULT '',
  model            TEXT NOT NULL DEFAULT 'gemini:gemini-2.0-flash-exp',
  tools            JSONB NOT NULL DEFAULT '[]',
  config           JSONB NOT NULL DEFAULT '{
    "max_iterations": 10,
    "temperature": 0.7,
    "max_tokens": 4096,
    "retry_on_error": true,
    "max_retries": 3,
    "retry_delay_seconds": 5,
    "enable_memory": false,
    "memory_top_k": 5,
    "stream_output": false,
    "timeout_seconds": 300
  }',
  current_task_id  UUID,  -- self-reference set later
  memory_namespace TEXT,
  created_by       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_workspace_id ON agents(workspace_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);

-- ============================================================
-- SPRINTS TABLE
-- ============================================================

CREATE TABLE sprints (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  status        sprint_status NOT NULL DEFAULT 'planning',
  goal          TEXT,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sprints_workspace_id ON sprints(workspace_id);
CREATE INDEX idx_sprints_status ON sprints(status);

-- ============================================================
-- TASKS TABLE
-- ============================================================

CREATE TABLE tasks (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sprint_id                   UUID REFERENCES sprints(id) ON DELETE SET NULL,
  agent_id                    UUID REFERENCES agents(id) ON DELETE SET NULL,
  parent_task_id              UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title                       TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  status                      task_status NOT NULL DEFAULT 'pending',
  priority                    task_priority NOT NULL DEFAULT 'normal',
  input                       JSONB NOT NULL DEFAULT '{}',
  output                      JSONB,
  error_message               TEXT,
  retry_count                 INTEGER NOT NULL DEFAULT 0,
  model_used                  TEXT,
  tokens_input                BIGINT NOT NULL DEFAULT 0,
  tokens_output               BIGINT NOT NULL DEFAULT 0,
  cost_usd                    NUMERIC(12, 8) NOT NULL DEFAULT 0,
  queued_at                   TIMESTAMPTZ,
  started_at                  TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,
  estimated_duration_seconds  INTEGER,
  actual_duration_seconds     INTEGER,
  depends_on                  UUID[] NOT NULL DEFAULT '{}',
  tags                        TEXT[] NOT NULL DEFAULT '{}',
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_by                  UUID NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_tags ON tasks USING gin(tags);

-- Add foreign key for agent current_task_id (after tasks table exists)
ALTER TABLE agents ADD CONSTRAINT fk_agents_current_task
  FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- ============================================================
-- TASK LOGS TABLE
-- ============================================================

CREATE TABLE task_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id       UUID REFERENCES agents(id) ON DELETE SET NULL,
  level          task_log_level NOT NULL DEFAULT 'info',
  type           task_log_type NOT NULL DEFAULT 'system',
  message        TEXT NOT NULL,
  data           JSONB,
  tokens_input   INTEGER,
  tokens_output  INTEGER,
  model          TEXT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_agent_id ON task_logs(agent_id);
CREATE INDEX idx_task_logs_level ON task_logs(level);
CREATE INDEX idx_task_logs_type ON task_logs(type);
CREATE INDEX idx_task_logs_created_at ON task_logs(created_at DESC);

-- ============================================================
-- SESSIONS TABLE
-- ============================================================

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id         UUID,  -- references auth.users(id), null for agent-agent sessions
  type            session_type NOT NULL DEFAULT 'user_agent',
  status          session_status NOT NULL DEFAULT 'active',
  messages        JSONB NOT NULL DEFAULT '[]',
  context         JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);

-- ============================================================
-- COMPUTE SERVERS TABLE
-- ============================================================

CREATE TABLE compute_servers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  provider            compute_provider NOT NULL,
  status              compute_server_status NOT NULL DEFAULT 'provisioning',
  provider_server_id  TEXT,
  region              TEXT,
  cpu                 INTEGER NOT NULL DEFAULT 1,
  memory_mb           INTEGER NOT NULL DEFAULT 512,
  disk_gb             INTEGER NOT NULL DEFAULT 10,
  public_url          TEXT,
  internal_url        TEXT,
  provider_metadata   JSONB NOT NULL DEFAULT '{}',
  cost_per_hour_usd   NUMERIC(8, 6),
  started_at          TIMESTAMPTZ,
  stopped_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compute_servers_workspace_id ON compute_servers(workspace_id);
CREATE INDEX idx_compute_servers_status ON compute_servers(status);
CREATE INDEX idx_compute_servers_provider ON compute_servers(provider);

-- ============================================================
-- USAGE EVENTS TABLE (metering / billing)
-- ============================================================

CREATE TABLE usage_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id         UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id          UUID REFERENCES tasks(id) ON DELETE SET NULL,
  session_id       UUID REFERENCES sessions(id) ON DELETE SET NULL,
  event_type       usage_event_type NOT NULL,
  quantity         BIGINT NOT NULL DEFAULT 0,
  cost_usd         NUMERIC(12, 8) NOT NULL DEFAULT 0,
  model            TEXT,
  provider         model_provider_type,
  metadata         JSONB NOT NULL DEFAULT '{}',
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_events_organization_id ON usage_events(organization_id);
CREATE INDEX idx_usage_events_workspace_id ON usage_events(workspace_id);
CREATE INDEX idx_usage_events_agent_id ON usage_events(agent_id);
CREATE INDEX idx_usage_events_task_id ON usage_events(task_id);
CREATE INDEX idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_recorded_at ON usage_events(recorded_at DESC);

-- Partition hint index for monthly billing queries (using immutable wrapper)
CREATE OR REPLACE FUNCTION date_trunc_month_immutable(ts TIMESTAMPTZ) RETURNS TIMESTAMPTZ
  LANGUAGE sql IMMUTABLE AS $$ SELECT date_trunc('month', ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' $$;
CREATE INDEX idx_usage_events_org_month ON usage_events(organization_id, date_trunc_month_immutable(recorded_at));

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_workspace_members_updated_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_model_providers_updated_at
  BEFORE UPDATE ON model_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sprints_updated_at
  BEFORE UPDATE ON sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_compute_servers_updated_at
  BEFORE UPDATE ON compute_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compute_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Plans are public (read-only for everyone)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly viewable"
  ON plans FOR SELECT
  USING (true);

-- ============================================================
-- Helper function: get org IDs the current user belongs to
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT w.organization_id
  FROM workspace_members wm
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid()
$$;

-- ============================================================
-- Helper function: get workspace IDs the current user is a member of
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
$$;

-- ============================================================
-- Helper function: check if user has a minimum role in workspace
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_workspace_role(
  p_workspace_id UUID,
  p_min_role workspace_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND CASE p_min_role
        WHEN 'viewer'    THEN role IN ('viewer', 'developer', 'admin', 'owner')
        WHEN 'developer' THEN role IN ('developer', 'admin', 'owner')
        WHEN 'admin'     THEN role IN ('admin', 'owner')
        WHEN 'owner'     THEN role = 'owner'
        ELSE false
      END
  )
$$;

-- ============================================================
-- RLS POLICIES: organizations
-- ============================================================

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "Org owners can update their org"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- RLS POLICIES: departments
-- ============================================================

CREATE POLICY "Org members can view departments"
  ON departments FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Org admins can manage departments"
  ON departments FOR ALL
  USING (
    organization_id IN (
      SELECT w.organization_id
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'owner')
    )
  );

-- ============================================================
-- RLS POLICIES: workspaces
-- ============================================================

CREATE POLICY "Workspace members can view their workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace admins can update workspaces"
  ON workspaces FOR UPDATE
  USING (user_has_workspace_role(id, 'admin'));

CREATE POLICY "Org members can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND created_by = auth.uid()
  );

CREATE POLICY "Workspace owners can delete workspaces"
  ON workspaces FOR DELETE
  USING (user_has_workspace_role(id, 'owner'));

-- ============================================================
-- RLS POLICIES: workspace_members
-- ============================================================

CREATE POLICY "Members can view workspace membership"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace admins can manage members"
  ON workspace_members FOR INSERT
  WITH CHECK (user_has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "Workspace admins can update member roles"
  ON workspace_members FOR UPDATE
  USING (user_has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "Workspace admins can remove members"
  ON workspace_members FOR DELETE
  USING (
    user_has_workspace_role(workspace_id, 'admin')
    OR user_id = auth.uid()  -- users can remove themselves
  );

-- ============================================================
-- RLS POLICIES: model_providers
-- ============================================================

CREATE POLICY "Workspace members can view model providers"
  ON model_providers FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace developers can manage model providers"
  ON model_providers FOR ALL
  USING (user_has_workspace_role(workspace_id, 'developer'));

-- ============================================================
-- RLS POLICIES: agents
-- ============================================================

CREATE POLICY "Workspace members can view agents"
  ON agents FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace developers can create agents"
  ON agents FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_user_workspace_ids())
    AND user_has_workspace_role(workspace_id, 'developer')
    AND created_by = auth.uid()
  );

CREATE POLICY "Workspace developers can update agents"
  ON agents FOR UPDATE
  USING (user_has_workspace_role(workspace_id, 'developer'));

CREATE POLICY "Workspace admins can delete agents"
  ON agents FOR DELETE
  USING (user_has_workspace_role(workspace_id, 'admin'));

-- ============================================================
-- RLS POLICIES: sprints
-- ============================================================

CREATE POLICY "Workspace members can view sprints"
  ON sprints FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace developers can manage sprints"
  ON sprints FOR ALL
  USING (user_has_workspace_role(workspace_id, 'developer'));

-- ============================================================
-- RLS POLICIES: tasks
-- ============================================================

CREATE POLICY "Workspace members can view tasks"
  ON tasks FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace developers can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_user_workspace_ids())
    AND user_has_workspace_role(workspace_id, 'developer')
  );

CREATE POLICY "Workspace developers can update tasks"
  ON tasks FOR UPDATE
  USING (user_has_workspace_role(workspace_id, 'developer'));

CREATE POLICY "Workspace admins can delete tasks"
  ON tasks FOR DELETE
  USING (user_has_workspace_role(workspace_id, 'admin'));

-- ============================================================
-- RLS POLICIES: task_logs
-- ============================================================

CREATE POLICY "Workspace members can view task logs"
  ON task_logs FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE workspace_id IN (SELECT get_user_workspace_ids())
    )
  );

CREATE POLICY "Task logs can be inserted by service role"
  ON task_logs FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE workspace_id IN (SELECT get_user_workspace_ids())
    )
  );

-- ============================================================
-- RLS POLICIES: sessions
-- ============================================================

CREATE POLICY "Workspace members can view sessions"
  ON sessions FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace members can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_user_workspace_ids())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Session owners and admins can update sessions"
  ON sessions FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_has_workspace_role(workspace_id, 'admin')
  );

-- ============================================================
-- RLS POLICIES: compute_servers
-- ============================================================

CREATE POLICY "Workspace members can view compute servers"
  ON compute_servers FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

CREATE POLICY "Workspace admins can manage compute servers"
  ON compute_servers FOR ALL
  USING (user_has_workspace_role(workspace_id, 'admin'));

-- ============================================================
-- RLS POLICIES: usage_events
-- ============================================================

CREATE POLICY "Workspace members can view usage events"
  ON usage_events FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Usage events are written by service role only — no INSERT policy for users

-- ============================================================
-- VIEWS: Sprint stats
-- ============================================================

CREATE OR REPLACE VIEW sprint_stats AS
SELECT
  s.id AS sprint_id,
  s.workspace_id,
  COUNT(t.id) AS total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'failed') AS failed_tasks,
  COUNT(t.id) FILTER (WHERE t.status IN ('running', 'queued')) AS in_progress_tasks,
  COALESCE(SUM(t.tokens_input + t.tokens_output), 0) AS total_tokens_used,
  COALESCE(SUM(t.cost_usd), 0) AS total_cost_usd,
  COALESCE(AVG(t.actual_duration_seconds), 0) AS avg_task_duration_seconds
FROM sprints s
LEFT JOIN tasks t ON t.sprint_id = s.id
GROUP BY s.id, s.workspace_id;

-- ============================================================
-- VIEWS: Workspace usage summary (current month)
-- ============================================================

CREATE OR REPLACE VIEW workspace_usage_current_month AS
SELECT
  workspace_id,
  organization_id,
  date_trunc('month', NOW()) AS month,
  SUM(quantity) FILTER (WHERE event_type = 'llm_tokens') AS tokens_used,
  SUM(quantity) FILTER (WHERE event_type = 'compute_seconds') / 3600.0 AS compute_hours_used,
  SUM(cost_usd) AS total_cost_usd
FROM usage_events
WHERE recorded_at >= date_trunc('month', NOW())
GROUP BY workspace_id, organization_id;

-- ============================================================
-- FUNCTIONS: Aggregate sprint stats inline
-- ============================================================

CREATE OR REPLACE FUNCTION get_sprint_stats(p_sprint_id UUID)
RETURNS TABLE (
  total_tasks BIGINT,
  completed_tasks BIGINT,
  failed_tasks BIGINT,
  in_progress_tasks BIGINT,
  total_tokens_used BIGINT,
  total_cost_usd NUMERIC,
  avg_task_duration_seconds NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(id),
    COUNT(id) FILTER (WHERE status = 'completed'),
    COUNT(id) FILTER (WHERE status = 'failed'),
    COUNT(id) FILTER (WHERE status IN ('running', 'queued')),
    COALESCE(SUM(tokens_input + tokens_output), 0),
    COALESCE(SUM(cost_usd), 0),
    COALESCE(AVG(actual_duration_seconds), 0)
  FROM tasks
  WHERE sprint_id = p_sprint_id
$$;

-- ============================================================
-- FUNCTIONS: Check workspace budget
-- ============================================================

CREATE OR REPLACE FUNCTION check_workspace_budget(p_workspace_id UUID)
RETURNS TABLE (
  tokens_used BIGINT,
  tokens_budget BIGINT,
  budget_pct_used NUMERIC,
  over_budget BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH usage AS (
    SELECT COALESCE(SUM(quantity), 0) AS tokens_used
    FROM usage_events
    WHERE workspace_id = p_workspace_id
      AND event_type = 'llm_tokens'
      AND recorded_at >= date_trunc('month', NOW())
  ),
  org_plan AS (
    SELECT p.token_budget_millions * 1000000 AS token_budget
    FROM workspaces w
    JOIN organizations o ON o.id = w.organization_id
    JOIN plans p ON p.id = o.plan_id
    WHERE w.id = p_workspace_id
  )
  SELECT
    u.tokens_used::BIGINT,
    op.token_budget::BIGINT,
    CASE WHEN op.token_budget > 0
      THEN ROUND((u.tokens_used::NUMERIC / op.token_budget) * 100, 2)
      ELSE 100
    END AS budget_pct_used,
    u.tokens_used >= op.token_budget AS over_budget
  FROM usage u, org_plan op
$$;
