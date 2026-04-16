'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Send, ChevronDown, Clock,
  CheckCircle2, XCircle, Loader2, Terminal, Zap,
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!_sb) _sb = createClient(supabaseUrl, supabaseKey);
  return _sb;
}

interface Command {
  id: string; command: string; payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: string | null; created_at: string; updated_at: string;
}

const AGENTS = [
  { value: 'auto', label: 'Auto-route (CentralBrain)' },
  { value: 'context', label: 'Context Agent' },
  { value: 'planner', label: 'Planner Agent' },
  { value: 'architect', label: 'Lead Architect' },
  { value: 'backend_eng', label: 'Backend Engineer' },
  { value: 'frontend_eng', label: 'Frontend Engineer' },
  { value: 'researcher', label: 'Research Agent' },
  { value: 'reviewer', label: 'Reviewer Agent' },
  { value: 'pm', label: 'PM Agent' },
  { value: 'domain', label: 'Domain Agent' },
];

// Status badge styles — rounded-md, tonal, only status-red uses hex
function statusBadgeClass(s: Command['status']) {
  const map: Record<string, string> = {
    pending: 'bg-[var(--surface-container-highest)] text-[var(--secondary)] rounded-md',
    running: 'bg-[var(--primary-container)] text-[var(--primary)] rounded-md',
    completed: 'bg-teal-500/15 text-teal-400 rounded-md',
    failed: 'bg-red-500/10 rounded-md',
  };
  return map[s] ?? map.failed;
}

function StatusIcon({ status }: { status: Command['status'] }) {
  if (status === 'pending') return <Clock className="h-3.5 w-3.5" />;
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === 'completed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <XCircle className="h-3.5 w-3.5" />;
}

function relativeTime(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  return Math.floor(min / 60) + 'h ago';
}

export default function DispatchPage() {
  const [connected, setConnected] = useState(false);
  const [commandText, setCommandText] = useState('');
  const [agent, setAgent] = useState('auto');
  const [commands, setCommands] = useState<Command[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchCommands = useCallback(async () => {
    const client = sb();
    if (!client) return;
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await client.from('commands').select('*')
      .gte('created_at', cutoff).order('created_at', { ascending: false }).limit(50);
    if (!error && data) { setCommands(data as Command[]); setConnected(true); }
    else { setConnected(false); }
  }, []);

  useEffect(() => {
    fetchCommands();
    const i = setInterval(fetchCommands, 2000);
    return () => clearInterval(i);
  }, [fetchCommands]);

  async function dispatch() {
    const client = sb();
    if (!client || !commandText.trim()) return;
    setDispatching(true);
    await client.from('commands').insert({
      command: commandText.trim(),
      payload: { agent: agent === 'auto' ? null : agent },
      status: 'pending',
    });
    setCommandText('');
    await fetchCommands();
    setDispatching(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); dispatch(); }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-container)] text-[var(--primary)]">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--on-surface)]">Dispatch Console</h1>
              <p className="text-sm text-[var(--on-surface-variant)]">Send tasks to your agent swarm</p>
            </div>
          </div>
          {/* Connection status — rounded-md, no rounded-full */}
          <div
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium ${
              connected
                ? 'bg-[var(--surface-container-high)] text-[var(--primary)]'
                : 'bg-[var(--surface-container)] text-[var(--on-surface-variant)] opacity-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-[var(--primary)]' : 'bg-[var(--on-surface-variant)]'
              }`}
            />
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>

        {/* Input box — tonal, no border */}
        <div className="bg-[var(--surface-container)] rounded-xl p-4">
          <textarea
            ref={inputRef}
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe the task or goal..."
            rows={3}
            className="w-full resize-none rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative">
              {/* Agent selector — no border */}
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] px-3 py-2 text-xs hover:bg-[var(--surface-bright)] transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-[var(--primary)]" />
                {AGENTS.find((a) => a.value === agent)?.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </button>
              {/* Dropdown — no border */}
              {dropdownOpen && (
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg bg-[var(--surface-container-highest)] py-1">
                  {AGENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => { setAgent(a.value); setDropdownOpen(false); }}
                      className={`block w-full px-4 py-2 text-left text-xs transition hover:bg-[var(--surface-bright)] ${
                        agent === a.value ? 'text-[var(--primary)]' : 'text-[var(--on-surface-variant)]'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={dispatch}
              disabled={dispatching || !commandText.trim() || !connected}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch
            </button>
          </div>
          <p className="mt-2 text-right text-[11px] text-[var(--on-surface-variant)] opacity-50">Cmd+Enter to dispatch</p>
        </div>

        {/* Recent commands */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-[var(--on-surface-variant)]">Recent Commands</h2>
          {commands.length === 0 && (
            <div
              className="rounded-xl py-12 text-center text-sm text-[var(--on-surface-variant)] opacity-50"
              style={{ outline: '1.5px dashed var(--outline-variant)' }}
            >
              No commands yet. Type a task above to get started.
            </div>
          )}
          <div className="space-y-2">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] px-4 py-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-sm text-[var(--on-surface)] break-words">{cmd.command}</p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(cmd.status)}`}
                    style={cmd.status === 'failed' ? { color: '#e87058' } : undefined}
                  >
                    <StatusIcon status={cmd.status} />{cmd.status}
                  </span>
                </div>
                {cmd.result && (
                  <div className="mt-2 rounded-lg bg-[var(--surface-container-high)] px-3 py-2 font-mono text-xs text-[var(--on-surface-variant)]">
                    {typeof cmd.result === 'string' ? cmd.result : JSON.stringify(cmd.result)}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--on-surface-variant)] opacity-50">
                  <span>{relativeTime(cmd.created_at)}</span>
                  {cmd.payload?.agent && (
                    <span className="rounded-md bg-[var(--surface-container-high)] px-1.5 py-0.5 opacity-80">
                      {String(cmd.payload.agent)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
