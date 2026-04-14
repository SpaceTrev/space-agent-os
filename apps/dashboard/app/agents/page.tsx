// apps/dashboard/app/agents/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  Send,
  Bot,
  User,
  ChevronLeft,
  Menu,
  Circle,
  Wifi,
  WifiOff,
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
const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const TIER_COLORS: Record<Tier, string> = {
  orchestrator: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  specialist: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  worker: "bg-slate-500/20 text-slate-400 border-slate-500/30",
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
    const channel = supabase
      .channel("connection-check")
      .on("presence", { event: "sync" }, () => setConnected(true))
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ---- Poll agent statuses from commands table ---- */
  useEffect(() => {
    const fetchStatuses = async () => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
            ? "bg-indigo-500/15 border border-indigo-500/30"
            : "hover:bg-slate-800/60 border border-transparent"
        }`}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg ${
            isSelected
              ? "bg-indigo-500/20 text-indigo-400"
              : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
          }`}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium truncate ${
                isSelected ? "text-indigo-300" : "text-slate-300"
              }`}
            >
              {agent.name}
            </span>
            <Circle
              className={`w-2 h-2 flex-shrink-0 fill-current ${STATUS_COLORS[status]}`}
            />
          </div>
          <p className="text-xs text-slate-500 truncate">{agent.role}</p>
        </div>
      </button>
    );
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---- Mobile overlay ---- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ---- Sidebar ---- */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-72 bg-[#0C0C0F] border-r border-slate-800/60
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Agent Swarm
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Wifi className="w-3 h-3" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
            <button
              className="md:hidden p-1 text-slate-400 hover:text-slate-200"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
            Orchestrators
          </p>
          {AGENTS.filter((a) => a.tier === "orchestrator").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}

          <p className="px-3 pt-4 py-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
            Specialists
          </p>
          {AGENTS.filter((a) => a.tier === "specialist").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}

          <p className="px-3 pt-4 py-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
            Workers
          </p>
          {AGENTS.filter((a) => a.tier === "worker").map((agent) => (
            <AgentListItem key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-3 border-t border-slate-800/60">
          <p className="text-[10px] text-slate-600">
            {AGENTS.length} agents registered
          </p>
        </div>
      </aside>

      {/* ---- Main chat area ---- */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedAgent ? (
          <>
            {/* Chat header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 bg-[#0C0C0F]/80 backdrop-blur-sm">
              <button
                className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-400">
                {selectedAgent.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-semibold text-slate-100">
                    {selectedAgent.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${
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
                <p className="text-xs text-slate-500">
                  {selectedAgent.role} &middot;{" "}
                  <span className="text-slate-600">{selectedAgent.model}</span>
                </p>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
                    {selectedAgent.icon}
                  </div>
                  <p className="text-sm text-slate-500 max-w-xs">
                    Send a message to start a conversation with{" "}
                    <span className="text-slate-400">
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
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-3.5 h-3.5" />
                      ) : (
                        <Bot className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white"
                          : msg.status === "error"
                          ? "bg-red-500/10 border border-red-500/20 text-red-300"
                          : "bg-slate-800/80 text-slate-200 border border-slate-700/50"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      <div
                        className={`flex items-center gap-1.5 mt-1.5 text-[10px] ${
                          msg.role === "user"
                            ? "text-indigo-300/60 justify-end"
                            : "text-slate-500"
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

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-800/60 bg-[#0C0C0F]/80 backdrop-blur-sm">
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
                    className="w-full resize-none rounded-xl bg-slate-800/60 border border-slate-700/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 max-h-32"
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
                  className="flex-shrink-0 p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-600 mt-2">
                Commands are sent via Supabase &middot; Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          /* No agent selected */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <button
              className="md:hidden p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 absolute top-4 left-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <Bot className="w-8 h-8 text-slate-600" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-300">
                Agent Chat
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Select an agent from the sidebar to start a conversation.
                Commands are executed through the Supabase pipeline.
              </p>
            </div>
            {/* Quick grid on mobile */}
            <div className="grid grid-cols-3 gap-2 mt-4 md:hidden">
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:border-indigo-500/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                    {agent.icon}
                  </div>
                  <span className="text-[10px] text-slate-400 text-center leading-tight">
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
