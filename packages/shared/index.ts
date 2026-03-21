// ─────────────────────────────────────────────────────────────────────────────
// @space-agent-os/shared
// Shared TypeScript types and API contracts between dashboard and core agent
// ─────────────────────────────────────────────────────────────────────────────

// ── Agent Status ─────────────────────────────────────────────────────────────
export type AgentStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'error'
  | 'sleeping'
  | 'terminated';

// ── Task Priority ─────────────────────────────────────────────────────────────
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// ── Model Tier ────────────────────────────────────────────────────────────────
export type ModelTier =
  | 'local'       // Ollama / local model
  | 'fast'        // Haiku / Flash / small cloud models
  | 'balanced'    // Sonnet / Pro / mid-tier cloud models
  | 'powerful';   // Opus / Ultra / flagship cloud models

// ── Heartbeat Event ───────────────────────────────────────────────────────────
export interface HeartbeatEvent {
  agent_id: string;
  timestamp: string;           // ISO 8601
  status: AgentStatus;
  current_task?: string | null;
  model_tier: ModelTier;
  loop_count: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

// ── Task ──────────────────────────────────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
  assigned_agent?: string | null;
  parent_task_id?: string | null;
  metadata?: Record<string, unknown>;
}

// ── Agent Config ──────────────────────────────────────────────────────────────
export interface AgentConfig {
  agent_id: string;
  name: string;
  model_tier: ModelTier;
  max_loops: number;
  sleep_interval_seconds: number;
  enabled: boolean;
}

// ── API Response wrapper ──────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
