-- apps/core/sync/migrations/001_initial.sql
-- Supabase migration: tables for the sync layer

create table system_state (
  id text primary key default 'singleton',
  health jsonb,
  updated_at timestamptz default now()
);

create table agent_status (
  name text primary key,
  role text,
  tier text,
  module text,
  status text default 'unknown',
  updated_at timestamptz default now()
);

create table model_status (
  name text primary key,
  available boolean default false,
  updated_at timestamptz default now()
);

create table commands (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  payload jsonb default '{}',
  status text default 'pending' check (status in ('pending','running','completed','failed')),
  result jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table system_state enable row level security;
alter table agent_status enable row level security;
alter table model_status enable row level security;
alter table commands enable row level security;

-- Allow anon read on status tables
create policy "anon_read_system" on system_state for select using (true);
create policy "anon_read_agents" on agent_status for select using (true);
create policy "anon_read_models" on model_status for select using (true);
create policy "anon_read_commands" on commands for select using (true);
create policy "anon_insert_commands" on commands for insert with check (true);

-- Service role can do everything (local sync daemon uses service key)
create policy "service_all_system" on system_state for all using (auth.role() = 'service_role');
create policy "service_all_agents" on agent_status for all using (auth.role() = 'service_role');
create policy "service_all_models" on model_status for all using (auth.role() = 'service_role');
create policy "service_all_commands" on commands for all using (auth.role() = 'service_role');
