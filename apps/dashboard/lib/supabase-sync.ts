// apps/dashboard/lib/supabase-sync.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────

export interface SystemState {
  id: string;
  health: Record<string, unknown>;
  updated_at: string;
}

export interface AgentStatus {
  name: string;
  role: string | null;
  tier: string | null;
  module: string | null;
  status: string;
  updated_at: string;
}

export interface ModelStatus {
  name: string;
  available: boolean;
  updated_at: string;
}

export interface Command {
  id: string;
  command: string;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ── Database schema (for typed client) ────────────────────────────

export interface Database {
  public: {
    Tables: {
      system_state: { Row: SystemState };
      agent_status: { Row: AgentStatus };
      model_status: { Row: ModelStatus };
      commands: { Row: Command };
    };
  };
}

// ── Client ────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

// ── Query helpers ─────────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemState | null> {
  const { data, error } = await supabase
    .from("system_state")
    .select("*")
    .eq("id", "singleton")
    .single();

  if (error) {
    console.error("getSystemHealth error:", error.message);
    return null;
  }
  return data;
}

export async function getAgentStatus(): Promise<AgentStatus[]> {
  const { data, error } = await supabase
    .from("agent_status")
    .select("*")
    .order("name");

  if (error) {
    console.error("getAgentStatus error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getModelStatus(): Promise<ModelStatus[]> {
  const { data, error } = await supabase
    .from("model_status")
    .select("*")
    .order("name");

  if (error) {
    console.error("getModelStatus error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function dispatchCommand(
  command: string,
  payload: Record<string, unknown> = {}
): Promise<Command | null> {
  const { data, error } = await supabase
    .from("commands")
    .insert({ command, payload, status: "pending" as const })
    .select()
    .single();

  if (error) {
    console.error("dispatchCommand error:", error.message);
    return null;
  }
  return data;
}
