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
} from "lucide-react";

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

// Tonal tier badges — no border classes
const TIER_COLORS: Record<Tier, string> = {
  orchestrator: "bg-indigo-500/15 text-indigo-400",
  specialist: "bg-purple-500/15 text-purple-400",
  worker: "bg-slate-500/15 text-slate-400",
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  ok: "text-emerald-400",
  working: "text-yellow-400",
  error: "text-red-400",
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
    const channel = getSupabase()!
      .channel("connection-check")
      .on("presence", { event: "sync" }, () => setConnected(true))
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      getSupabase()!.removeChannel(channel);
    };
  }, []);

  /* ---- Poll agent statuses from commands table ---- */
  useEffect(() => {
    const fetchStatuses = async () => {
      const { data, error } = await getSupabase()!
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
      const ids = Array.from(pendingCommands.current);
      const { data, error } = await getSupabase()!
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
      const { data, error } = await getSupabase()!
        .from("commands")
        .insert({
          type: "agent_chat",
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
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
          isSelected
            ? "bg-[var(--surface-container-high)] text-[var(--primary)]"
            : "hover:bg-[var(--surface-container)]"
        }`}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg ${
            isSelected
              ? "bg-[var(--primary-container)] text-[var(--primary)]"
              : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] group-hover:text-[var(--on-surface)]"
          }`}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium truncate ${
                isSelected ? "text-[var(--primary)]" : "text-[var(--on-surface)]"
              }`}
            >
              {agent.name}
            </span>
            <Circle
              className={`w-2 h-2 flex-shrink-0 fill-current ${STATUS_COLORS[status]}`}
            />
          </div>
          <p className="text-xs text-[var(--on-surface-variant)] truncate">{agent.role}</p>
        </div>
      </button>
    );
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      {/* ---- Mobile overlay ---- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[var(--surface)]/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ---- Sidebar — no explicit border ---- */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-72 bg-[var(--surface-container-low)]
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Sidebar header — no border, tonal elevation */}
        <div className="flex items-center justify-between px-4 py-4 bg-[var(--surface-container)]">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-sm font-semibold text-[var(--on-surface)]">
              Agent Swarm
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status — inline dot + text, no pill */}
            <span className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span
                className={connected ? "text-emerald-400" : "text-red-400"}
              >
                {connected ? "Live" : "Offline"}
              </span>
            </span>
            <button
              className="md:hidden p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--primary)] font-semibold">
            Orchestrators
          </p>
          {AGENTS.filter((a) => a.tier === "orchestrator").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}

          <p className="px-3 pt-4 py-2 text-[10px] uppercase tracking-widest text-[var(--on-surface-variant)] font-semibold">
            Specialists
          </p>
          {AGENTS.filter((a) => a.tier === "specialist").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}

          <p className="px-3 pt-4 py-2 text-[10px] uppercase tracking-widest text-[var(--on-surface-variant)] font-semibold">
            Workers
          </p>
          {AGENTS.filter((a) => a.tier === "worker").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Sidebar footer — no border-t, tonal bg */}
        <div className="px-4 py-3 bg-[var(--surface-container)]">
          <p className="text-[10px] text-[var(--on-surface-variant)] opacity-60">
            {AGENTS.length} agents registered
          </p>
        </div>
      </aside>

      {/* ---- Main chat area ---- */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedAgent ? (
          <>
            {/* Chat header — frosted, no border */}
            <header className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-container-low)] [backdrop-filter:blur(8px)]">
              <button
                className="md:hidden p-1.5 -ml-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-lg hover:bg-[var(--surface-container)]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--primary-container)] text-[var(--primary)]">
                {selectedAgent.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-semibold text-[var(--on-surface)]">
                    {selectedAgent.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-md ${
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
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {selectedAgent.role} &middot;{" "}
                  <span className="opacity-60">{selectedAgent.model}</span>
                </p>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                  <div className="w-12 h-12 rounded-xl bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)]">
                    {selectedAgent.icon}
                  </div>
                  <p className="text-sm text-[var(--on-surface-variant)] max-w-xs">
                    Send a message to start a conversation with{" "}
                    <span className="text-[var(--on-surface)]">
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
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
                        msg.role === "user"
                          ? "bg-[var(--primary-container)] text-[var(--primary)]"
                          : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
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
                      className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[var(--primary-container)] text-[var(--on-surface)]"
                          : msg.status === "error"
                          ? "bg-red-500/10 text-red-300"
                          : "bg-[var(--surface-container-high)] text-[var(--on-surface)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      <div
                        className={`flex items-center gap-1.5 mt-1.5 text-[10px] ${
                          msg.role === "user"
                            ? "text-[var(--on-surface-variant)] opacity-60 justify-end"
                            : "text-[var(--on-surface-variant)] opacity-60"
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

            {/* Input — no border, tonal bg */}
            <div className="px-4 py-3 bg-[var(--surface-container-low)] [backdrop-filter:blur(8px)]">
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
                    className="w-full resize-none rounded-lg bg-[var(--surface-container)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary)]/40 outline-none max-h-32"
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
                  className="flex-shrink-0 p-2.5 rounded-lg bg-[var(--primary)] text-[var(--surface)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-[var(--on-surface-variant)] opacity-50 mt-2">
                Commands are sent via Supabase &middot; Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          /* No agent selected */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <button
              className="md:hidden p-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-lg hover:bg-[var(--surface-container)] absolute top-4 left-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-xl bg-[var(--surface-container-high)] flex items-center justify-center">
              <Bot className="w-8 h-8 text-[var(--on-surface-variant)]" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                Agent Chat
              </h2>
              <p className="text-sm text-[var(--on-surface-variant)] mt-1 max-w-sm">
                Select an agent from the sidebar to start a conversation.
                Commands are executed through the Supabase pipeline.
              </p>
            </div>
            {/* Quick grid on mobile — no border */}
            <div className="grid grid-cols-3 gap-2 mt-4 md:hidden">
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)]">
                    {agent.icon}
                  </div>
                  <span className="text-[10px] text-[var(--on-surface-variant)] text-center leading-tight">
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
