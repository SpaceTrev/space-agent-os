// ============================================================
// Agent OS — Core Platform Types
// ============================================================

// ----------------------------------------------------------
// Billing / Plans
// ----------------------------------------------------------

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise'

export interface Plan {
  id: string
  name: string
  tier: PlanTier
  price_monthly: number
  price_yearly: number
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
  /** Maximum agents allowed in a workspace */
  max_agents: number
  /** Maximum concurrent tasks */
  max_concurrent_tasks: number
  /** Maximum workspace members */
  max_members: number
  /** Included compute hours per month */
  compute_hours_included: number
  /** Token budget per month (millions) */
  token_budget_millions: number
  /** Whether custom model provider API keys are allowed */
  custom_providers: boolean
  /** Whether dedicated compute servers are allowed */
  dedicated_compute: boolean
  /** Whether multi-department / org-level features are enabled */
  departments_enabled: boolean
  features: string[]
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------
// Organizations (top-level tenant)
// ----------------------------------------------------------

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan_id: string
  plan?: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | null
  billing_email: string | null
  billing_cycle: 'monthly' | 'yearly'
  trial_ends_at: string | null
  owner_id: string
  settings: OrganizationSettings
  created_at: string
  updated_at: string
}

export interface OrganizationSettings {
  allow_member_invites: boolean
  default_model_provider: string
  enforce_sso: boolean
  audit_log_retention_days: number
  allowed_domains: string[]
}

// ----------------------------------------------------------
// Workspaces (project-level isolation within an org)
// ----------------------------------------------------------

export type WorkspaceStatus = 'active' | 'paused' | 'archived'

export interface Workspace {
  id: string
  organization_id: string
  organization?: Organization
  name: string
  slug: string
  description: string | null
  status: WorkspaceStatus
  department_id: string | null
  department?: Department
  settings: WorkspaceSettings
  /** Encrypted API key overrides at workspace level */
  model_config: WorkspaceModelConfig
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  default_agent_model: string
  max_task_retries: number
  task_timeout_seconds: number
  enable_agent_memory: boolean
  memory_retention_days: number
  auto_pause_on_budget_exhaustion: boolean
  notification_channels: NotificationChannel[]
}

export interface WorkspaceModelConfig {
  /** Provider id overrides — keys encrypted at rest */
  providers: Record<string, { encrypted_api_key: string; iv: string }>
  default_provider: string
  default_model: string
  fallback_model: string | null
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'discord' | 'webhook'
  destination: string
  events: ('task_complete' | 'task_failed' | 'agent_error' | 'budget_warning')[]
}

// ----------------------------------------------------------
// Workspace Members
// ----------------------------------------------------------

export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'viewer'

export interface WorkspaceMember {
  id: string
  workspace_id: string
  workspace?: Workspace
  user_id: string
  role: WorkspaceRole
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------
// Departments (org-level grouping of workspaces / teams)
// ----------------------------------------------------------

export interface Department {
  id: string
  organization_id: string
  organization?: Organization
  name: string
  description: string | null
  head_user_id: string | null
  budget_tokens_monthly: number | null
  budget_compute_hours_monthly: number | null
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------
// Model Providers
// ----------------------------------------------------------

export type ModelProviderType =
  | 'anthropic'
  | 'gemini'
  | 'perplexity'
  | 'groq'
  | 'mistral'
  | 'openrouter'
  | 'ollama'

export interface ModelProvider {
  id: string
  workspace_id: string
  provider_type: ModelProviderType
  display_name: string
  /** Encrypted API key stored in DB */
  encrypted_api_key: string | null
  /** IV for decryption */
  iv: string | null
  base_url: string | null
  is_active: boolean
  is_verified: boolean
  /** Models available from this provider (cached) */
  available_models: ModelDefinition[]
  created_at: string
  updated_at: string
}

export interface ModelDefinition {
  id: string
  name: string
  provider: ModelProviderType
  context_window: number
  max_output_tokens: number
  /** Cost per 1M input tokens in USD */
  input_cost_per_million: number
  /** Cost per 1M output tokens in USD */
  output_cost_per_million: number
  supports_vision: boolean
  supports_function_calling: boolean
  is_free: boolean
}

// ----------------------------------------------------------
// Agents
// ----------------------------------------------------------

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'archived'
export type AgentType = 'worker' | 'orchestrator' | 'specialist' | 'reviewer'

export interface Agent {
  id: string
  workspace_id: string
  workspace?: Workspace
  name: string
  description: string | null
  type: AgentType
  status: AgentStatus
  /** System prompt for the agent */
  system_prompt: string
  /** Model to use (provider:model-id format) */
  model: string
  /** Tool definitions available to the agent */
  tools: AgentTool[]
  /** Agent configuration */
  config: AgentConfig
  /** Current task being executed */
  current_task_id: string | null
  /** Memory / context store reference */
  memory_namespace: string | null
  /** Extensible metadata including skills */
  metadata?: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface AgentTool {
  name: string
  description: string
  /** JSON Schema for parameters */
  parameters: Record<string, unknown>
  /** Handler type: 'builtin' | 'webhook' | 'mcp' */
  handler_type: 'builtin' | 'webhook' | 'mcp'
  handler_config: Record<string, unknown>
}

export interface AgentConfig {
  max_iterations: number
  temperature: number
  max_tokens: number
  retry_on_error: boolean
  max_retries: number
  retry_delay_seconds: number
  enable_memory: boolean
  memory_top_k: number
  stream_output: boolean
  timeout_seconds: number
}

// ----------------------------------------------------------
// Sprints (batches of tasks)
// ----------------------------------------------------------

export type SprintStatus = 'planning' | 'active' | 'paused' | 'completed' | 'canceled'

export interface Sprint {
  id: string
  workspace_id: string
  workspace?: Workspace
  name: string
  description: string | null
  status: SprintStatus
  goal: string | null
  starts_at: string | null
  ends_at: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  /** Aggregated stats */
  stats?: SprintStats
}

export interface SprintStats {
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  in_progress_tasks: number
  total_tokens_used: number
  total_cost_usd: number
  avg_task_duration_seconds: number
}

// ----------------------------------------------------------
// Tasks
// ----------------------------------------------------------

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'retrying'

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export interface Task {
  id: string
  workspace_id: string
  workspace?: Workspace
  sprint_id: string | null
  sprint?: Sprint
  agent_id: string | null
  agent?: Agent
  parent_task_id: string | null
  parent_task?: Task
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  /** Input data for the task */
  input: Record<string, unknown>
  /** Output / result data */
  output: Record<string, unknown> | null
  error_message: string | null
  /** Number of retry attempts so far */
  retry_count: number
  /** Model used for execution */
  model_used: string | null
  /** Token usage breakdown */
  tokens_input: number
  tokens_output: number
  cost_usd: number
  /** Execution timing */
  queued_at: string | null
  started_at: string | null
  completed_at: string | null
  /** Estimated duration in seconds */
  estimated_duration_seconds: number | null
  actual_duration_seconds: number | null
  /** Dependencies: task IDs that must complete first */
  depends_on: string[]
  tags: string[]
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------
// Task Logs
// ----------------------------------------------------------

export type TaskLogLevel = 'debug' | 'info' | 'warn' | 'error'
export type TaskLogType =
  | 'system'
  | 'llm_call'
  | 'tool_call'
  | 'tool_result'
  | 'agent_thought'
  | 'agent_action'
  | 'retry'
  | 'error'

export interface TaskLog {
  id: string
  task_id: string
  task?: Task
  agent_id: string | null
  level: TaskLogLevel
  type: TaskLogType
  message: string
  /** Structured data payload */
  data: Record<string, unknown> | null
  /** Token counts if this log entry is for an LLM call */
  tokens_input: number | null
  tokens_output: number | null
  model: string | null
  duration_ms: number | null
  created_at: string
}

// ----------------------------------------------------------
// Sessions (user/agent interaction sessions)
// ----------------------------------------------------------

export type SessionStatus = 'active' | 'idle' | 'ended'
export type SessionType = 'user_agent' | 'agent_agent' | 'debug'

export interface Session {
  id: string
  workspace_id: string
  workspace?: Workspace
  agent_id: string
  agent?: Agent
  user_id: string | null
  type: SessionType
  status: SessionStatus
  /** Conversation history */
  messages: SessionMessage[]
  /** Current context / working memory */
  context: Record<string, unknown>
  started_at: string
  last_active_at: string
  ended_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | SessionMessageContent[]
  tool_call_id: string | null
  tool_name: string | null
  tokens_input: number | null
  tokens_output: number | null
  model: string | null
  created_at: string
}

export interface SessionMessageContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: { type: 'base64' | 'url'; media_type: string; data: string }
  id?: string
  name?: string
  input?: Record<string, unknown>
  content?: string | SessionMessageContent[]
}

// ----------------------------------------------------------
// Compute Servers
// ----------------------------------------------------------

export type ComputeProvider = 'railway' | 'fly' | 'custom'
export type ComputeServerStatus = 'provisioning' | 'running' | 'stopping' | 'stopped' | 'error'

export interface ComputeServer {
  id: string
  workspace_id: string
  workspace?: Workspace
  name: string
  provider: ComputeProvider
  status: ComputeServerStatus
  /** Provider-specific server ID */
  provider_server_id: string | null
  region: string | null
  /** CPU count */
  cpu: number
  /** RAM in MB */
  memory_mb: number
  /** Disk in GB */
  disk_gb: number
  /** Public URL if accessible */
  public_url: string | null
  /** Internal URL for agent communication */
  internal_url: string | null
  /** Provider-specific metadata */
  provider_metadata: Record<string, unknown>
  cost_per_hour_usd: number | null
  started_at: string | null
  stopped_at: string | null
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------
// Usage Events (metering)
// ----------------------------------------------------------

export type UsageEventType =
  | 'llm_tokens'
  | 'compute_seconds'
  | 'storage_gb_hour'
  | 'api_request'
  | 'tool_execution'

export interface UsageEvent {
  id: string
  organization_id: string
  workspace_id: string
  agent_id: string | null
  task_id: string | null
  session_id: string | null
  event_type: UsageEventType
  /** Quantity consumed (tokens, seconds, etc.) */
  quantity: number
  /** Cost in USD */
  cost_usd: number
  model: string | null
  provider: ModelProviderType | null
  metadata: Record<string, unknown>
  recorded_at: string
  created_at: string
}

// ----------------------------------------------------------
// Shared / Utility Types
// ----------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

export type SortOrder = 'asc' | 'desc'

export interface QueryOptions {
  page?: number
  per_page?: number
  sort_by?: string
  sort_order?: SortOrder
  search?: string
  filters?: Record<string, unknown>
}

// ----------------------------------------------------------
// LLM / Model Call Types
// ----------------------------------------------------------

export interface ModelCallOptions {
  provider: ModelProviderType
  model: string
  messages: ModelMessage[]
  system?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
  tools?: ModelTool[]
  api_key?: string
  base_url?: string
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | ModelMessageContent[]
  tool_call_id?: string
  name?: string
}

export interface ModelMessageContent {
  type: 'text' | 'image_url' | 'tool_use' | 'tool_result'
  text?: string
  image_url?: { url: string }
  id?: string
  name?: string
  input?: Record<string, unknown>
  content?: string
}

export interface ModelTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ModelCallResult {
  content: string
  tool_calls?: ModelToolCall[]
  tokens_input: number
  tokens_output: number
  model: string
  provider: ModelProviderType
  finish_reason: 'stop' | 'tool_use' | 'max_tokens' | 'error'
  raw?: unknown
}

export interface ModelToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}
