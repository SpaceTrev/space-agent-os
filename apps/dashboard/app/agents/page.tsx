// apps/dashboard/app/agents/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  Send,
  Bot,
  User,
  ChevronLeft,
  Menu,
  Circle,
  Loader2,
  X,
  Sparkles,
  Shield,
  Code2,
  Search,
  LayoutDashboard,
  Brain,
  FileCode2,
  Globe,
  LogIn,
  LogOut,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/* ------------------------------------------------------------------ */
/*  Supabase client                                                    */
/* ------------------------------------------------------------------ */
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

/* ------------------------------------------------------------------ */
/*  Agent definitions                                                  */
/* ------------------------------------------------------------------ */
type AgentStatus = "ok" | "working" | "error";
type Tier = "orchestrator" | "specialist" | "worker";

interface AgentDef {
  id: string;
  name: string;
  role: string;
  tier: Tier;
  model: string;
  icon: React.ReactNode;
}

const AGENTS: AgentDef[] = [
  {
    id: "context-agent",
    name: "ContextAgent",
    role: "Context & Memory Manager",
    tier: "orchestrator",
    model: "gpt-4o",
    icon: <Brain className="w-4 h-4" />,
  },
  {
    id: "pm-agent",
    name: "PMAgent",
    role: "Project Manager",
    tier: "orchestrator",
    model: "gpt-4o",
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    id: "planner-agent",
    name: "PlannerAgent",
    role: "Task Planner & Decomposer",
    tier: "orchestrator",
    model: "gpt-4o",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: "researcher-agent",
    name: "ResearcherAgent",
    role: "Research & Analysis",
    tier: "specialist",
    model: "gpt-4o",
    icon: <Search className="w-4 h-4" />,
  },
  {
    id: "lead-architect-agent",
    name: "LeadArchitectAgent",
    role: "System Architecture Lead",
    tier: "specialist",
    model: "claude-sonnet-4-20250514",
    icon: <Shield className="w-4 h-4" />,
  },
  {
    id: "reviewer-agent",
    name: "ReviewerAgent",
    role: "Code Review & QA",
    tier: "specialist",
    model: "claude-sonnet-4-20250514",
    icon: <FileCode2 className="w-4 h-4" />,
  },
  {
    id: "backend-engineer-agent",
    name: "BackendEngineerAgent",
    role: "Backend Engineering",
    tier: "worker",
    model: "claude-sonnet-4-20250514",
    icon: <Code2 className="w-4 h-4" />,
  },
  {
    id: "frontend-engineer-agent",
    name: "FrontendEngineerAgent",
    role: "Frontend Engineering",
    tier: "worker",
    model: "claude-sonnet-4-20250514",
    icon: <Code2 className="w-4 h-4" />,
  },
  {
    id: "domain-agent",
    name: "DomainAgent",
    role: "Domain & DNS Management",
    tier: "worker",
    model: "gpt-4o-mini",
    icon: <Globe className="w-4 h-4" />,
  },
];

// Tonal tier badges — label-sm, container tokens, rounded-sm
const TIER_COLORS: Record<Tier, string> = {
  orchestrator: "bg-primary-container text-on-surface",
  specialist: "bg-secondary-container text-on-surface",
  worker: "bg-tertiary-container text-on-surface",
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  ok: "text-primary",
  working: "text-secondary",
  error: "text-on-surface-variant",
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  status?: "pending" | "processing" | "complete" | "error";
}

interface CommandRow {
  id: string;
  status: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Top nav with user menu                                             */
/* ------------------------------------------------------------------ */
function AgentsNav() {
  const { user, logout, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <nav className="flex items-center gap-3 px-4 h-12 bg-surface-low border-b border-outline-variant/20 flex-shrink-0">
      <Link href="/mission-control" className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
        <Bot className="w-4 h-4" />
        <span className="font-display text-sm font-semibold text-on-surface">Space-Claw</span>
      </Link>
      <span className="text-outline-variant/40">/</span>
      <span className="text-sm text-on-surface-variant">Agents</span>
      <div className="flex-1" />
      {loading ? (
        <div className="w-6 h-6 rounded-full bg-surface-highest animate-pulse" />
      ) : !user ? (
        <Link href="/login" className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant hover:text-on-surface transition-colors">
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign in</span>
        </Link>
      ) : (
        <div ref={ref} className="relative">
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5" aria-label="User menu">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white select-none">
              {(user.name ? user.name.split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2) : user.email.slice(0, 2).toUpperCase())}
            </div>
            <ChevronDown className={`w-3 h-3 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-outline-variant/20 bg-surface-low shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/10">
                <p className="text-[12px] font-semibold text-on-surface truncate">{user.name || "User"}</p>
                <p className="text-[10px] text-on-surface-variant truncate">{user.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setOpen(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-surface-base transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [connected, setConnected] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingCommands = useRef<Set<string>>(new Set());

  /* ---- scroll to bottom on new messages ---- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedAgent]);

  /* ---- Supabase connection check ---- */
  useEffect(() => {
    const client = getSupabase();
    if (!client) { setConnected(false); return; }

    const channel = client
      .channel("connection-check")
      .on("presence", { event: "sync" }, () => setConnected(true))
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  /* ---- Poll agent statuses from commands table ---- */
  useEffect(() => {
    const fetchStatuses = async () => {
      const client = getSupabase();
      if (!client) return;
      const { data, error } = await client
        .from("commands")
        .select("payload, status")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return;

      const statusMap: Record<string, AgentStatus> = {};
      for (const agent of AGENTS) {
        const agentCmds = data.filter(
          (d: any) => d.payload?.agent === agent.id
        );
        if (agentCmds.length === 0) {
          statusMap[agent.id] = "ok";
        } else if (agentCmds.some((c: any) => c.status === "error")) {
          statusMap[agent.id] = "error";
        } else if (
          agentCmds.some(
            (c: any) => c.status === "pending" || c.status === "processing"
          )
        ) {
          statusMap[agent.id] = "working";
        } else {
          statusMap[agent.id] = "ok";
        }
      }
      setAgentStatuses(statusMap);
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Poll for pending command results ---- */
  useEffect(() => {
    if (pendingCommands.current.size === 0) return;

    const pollResults = async () => {
      const client = getSupabase();
      if (!client) return;
      const ids = Array.from(pendingCommands.current);
      const { data, error } = await client
        .from("commands")
        .select("id, status, result, updated_at")
        .in("id", ids);

      if (error || !data) return;

      for (const row of data as CommandRow[]) {
        if (row.status === "complete" || row.status === "error") {
          pendingCommands.current.delete(row.id);

          setMessages((prev) => {
            const updated = { ...prev };
            for (const agentId of Object.keys(updated)) {
              updated[agentId] = updated[agentId].map((msg) => {
                if (msg.id === row.id) {
                  return { ...msg, status: row.status as any };
                }
                return msg;
              });

              // Add agent response
              if (row.result) {
                const hasResponse = updated[agentId].some(
                  (m) => m.id === `${row.id}-response`
                );
                if (
                  !hasResponse &&
                  updated[agentId].some((m) => m.id === row.id)
                ) {
                  updated[agentId] = [
                    ...updated[agentId],
                    {
                      id: `${row.id}-response`,
                      role: "agent",
                      content: row.result,
                      timestamp: new Date(row.updated_at),
                      status: row.status === "error" ? "error" : "complete",
                    },
                  ];
                }
              }
            }
            return updated;
          });
        }
      }
    };

    const interval = setInterval(pollResults, 2000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Send message ---- */
  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedAgent || sending) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase not configured");
      const { data, error } = await client
        .from("commands")
        .insert({
          command: content,
          status: "pending",
          payload: {
            agent: selectedAgent.id,
            message: content,
            timestamp: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (error) throw error;

      const commandId = data.id;
      pendingCommands.current.add(commandId);

      const userMsg: ChatMessage = {
        id: commandId,
        role: "user",
        content,
        timestamp: new Date(),
        status: "pending",
      };

      setMessages((prev) => ({
        ...prev,
        [selectedAgent.id]: [...(prev[selectedAgent.id] || []), userMsg],
      }));
    } catch (err) {
      console.error("Failed to send command:", err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "agent",
        content: "Failed to send message. Check your connection and try again.",
        timestamp: new Date(),
        status: "error",
      };
      setMessages((prev) => ({
        ...prev,
        [selectedAgent.id]: [...(prev[selectedAgent.id] || []), errorMsg],
      }));
    } finally {
      setSending(false);
    }
  }, [input, selectedAgent, sending]);

  /* ---- Agent messages for selected agent ---- */
  const currentMessages = selectedAgent
    ? messages[selectedAgent.id] || []
    : [];

  /* ---- Agent list item ---- */
  const AgentListItem = ({ agent }: { agent: AgentDef }) => {
    const status = agentStatuses[agent.id] || "ok";
    const isSelected = selectedAgent?.id === agent.id;

    return (
      <button
        onClick={() => {
          setSelectedAgent(agent);
          setSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left group ${
          isSelected
            ? "bg-surface-base text-primary"
            : "hover:bg-surface-base"
        }`}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-md ${
            isSelected
              ? "bg-primary-container text-primary"
              : "bg-surface-base text-on-surface-variant group-hover:text-on-surface"
          }`}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-display text-sm font-semibold truncate ${
                isSelected ? "text-primary" : "text-on-surface"
              }`}
            >
              {agent.name}
            </span>
            <Circle
              className={`w-2 h-2 flex-shrink-0 fill-current ${STATUS_COLORS[status]}`}
            />
          </div>
          <p className="font-data text-xs text-on-surface-variant truncate">{agent.role}</p>
        </div>
      </button>
    );
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <AgentsNav />
      {/* ---- Mobile overlay ---- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-surface/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ---- Sidebar — tonal nesting, no border ---- */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-72 bg-surface-low
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Sidebar header — tonal elevation, no border */}
        <div className="flex items-center justify-between px-4 py-4 bg-surface-base">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="font-display text-sm font-semibold text-on-surface">
              Agent Swarm
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status — inline dot + text, ghost a11y border only */}
            <span className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-sm ${
                  connected ? "bg-primary" : "bg-secondary"
                }`}
              />
              <span
                className={connected ? "text-primary" : "text-secondary"}
              >
                {connected ? "Live" : "Offline"}
              </span>
            </span>
            <button
              className="md:hidden p-1 text-on-surface-variant hover:text-on-surface"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="label-sm px-3 py-2 text-primary">
            Orchestrators
          </p>
          {AGENTS.filter((a) => a.tier === "orchestrator").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}

          <p className="label-sm px-3 pt-4 py-2 text-on-surface-variant">
            Specialists
          </p>
          {AGENTS.filter((a) => a.tier === "specialist").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}

          <p className="label-sm px-3 pt-4 py-2 text-on-surface-variant">
            Workers
          </p>
          {AGENTS.filter((a) => a.tier === "worker").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Sidebar footer — tonal bg, no border-t */}
        <div className="px-4 py-3 bg-surface-base">
          <p className="font-data text-[10px] text-on-surface-variant opacity-60">
            {AGENTS.length} agents registered
          </p>
        </div>
      </aside>

      {/* ---- Main chat area ---- */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface-base">
        {selectedAgent ? (
          <>
            {/* Chat header — tonal, no border */}
            <header className="flex items-center gap-3 px-4 py-3 bg-surface-low [backdrop-filter:blur(8px)]">
              <button
                className="md:hidden p-1.5 -ml-1 text-on-surface-variant hover:text-on-surface rounded-md hover:bg-surface-base"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary-container text-primary">
                {selectedAgent.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-sm font-semibold text-on-surface">
                    {selectedAgent.name}
                  </h1>
                  <span
                    className={`label-sm inline-flex items-center px-1.5 py-0.5 rounded-sm ${
                      TIER_COLORS[selectedAgent.tier]
                    }`}
                  >
                    {selectedAgent.tier}
                  </span>
                  <Circle
                    className={`w-2 h-2 fill-current ${
                      STATUS_COLORS[agentStatuses[selectedAgent.id] || "ok"]
                    }`}
                  />
                </div>
                <p className="font-data text-xs text-on-surface-variant">
                  {selectedAgent.role} &middot;{" "}
                  <span className="opacity-60">{selectedAgent.model}</span>
                </p>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                  <div className="w-12 h-12 rounded-md bg-surface-highest flex items-center justify-center text-on-surface-variant">
                    {selectedAgent.icon}
                  </div>
                  <p className="font-body text-sm text-on-surface-variant max-w-xs">
                    Send a message to start a conversation with{" "}
                    <span className="text-on-surface">
                      {selectedAgent.name}
                    </span>
                  </p>
                </div>
              )}

              {currentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex items-start gap-2.5 max-w-[85%] md:max-w-[70%] ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
                        msg.role === "user"
                          ? "bg-primary-container text-primary"
                          : "bg-surface-highest text-on-surface-variant"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-3.5 h-3.5" />
                      ) : (
                        <Bot className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Bubble — no border */}
                    <div
                      className={`rounded-md px-3.5 py-2.5 font-body text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary-container text-on-surface"
                          : msg.status === "error"
                          ? "bg-surface-highest text-on-surface-variant "
                          : "bg-surface-highest text-on-surface"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      <div
                        className={`flex items-center gap-1.5 mt-1.5 font-data text-[10px] text-on-surface-variant opacity-60 ${
                          msg.role === "user" ? "justify-end" : ""
                        }`}
                      >
                        {msg.status === "pending" && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        )}
                        {msg.status === "processing" && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        )}
                        <span>
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {msg.status === "pending" && (
                          <span>&middot; Sending</span>
                        )}
                        {msg.status === "processing" && (
                          <span>&middot; Processing</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input — highest elevation, no border at rest */}
            <div className="px-4 py-3 bg-surface-low [backdrop-filter:blur(8px)]">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={`Message ${selectedAgent.name}...`}
                    rows={1}
                    className="w-full resize-none rounded-md bg-surface-highest text-on-surface placeholder:text-on-surface-variant font-body px-4 py-2.5 text-sm focus:ring-2 focus:ring-secondary/40 outline-none max-h-32"
                    style={{
                      minHeight: "42px",
                      height: "auto",
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height =
                        Math.min(target.scrollHeight, 128) + "px";
                    }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 p-2.5 rounded-md bg-primary text-on-primary hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="font-data text-center text-[10px] text-on-surface-variant opacity-50 mt-2">
                Commands are sent via Supabase &middot; Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          /* No agent selected */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <button
              className="md:hidden p-2 text-on-surface-variant hover:text-on-surface rounded-md hover:bg-surface-highest absolute top-4 left-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-md bg-surface-highest flex items-center justify-center">
              <Bot className="w-8 h-8 text-on-surface-variant" />
            </div>
            <div className="text-center">
              <h2 className="font-display text-lg font-semibold text-on-surface">
                Agent Chat
              </h2>
              <p className="font-body text-sm text-on-surface-variant mt-1 max-w-sm">
                Select an agent from the sidebar to start a conversation.
                Commands are executed through the Supabase pipeline.
              </p>
            </div>
            {/* Quick grid on mobile — agent selector pills */}
            <div className="grid grid-cols-3 gap-2 mt-4 md:hidden">
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-md bg-surface-highest hover:bg-surface-bright transition-colors"
                >
                  <div className="w-8 h-8 rounded-sm bg-tertiary-container flex items-center justify-center text-on-surface">
                    {agent.icon}
                  </div>
                  <span className="font-data text-[10px] text-on-surface-variant text-center leading-tight">
                    {agent.name.replace("Agent", "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
