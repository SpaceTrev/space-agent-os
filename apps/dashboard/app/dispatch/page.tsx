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

function statusBadgeClass(s: Command['status']) {
  const map: Record<string, string> = {
    completed: 'bg-primary-container text-primary rounded-md',
    running: 'bg-secondary-container text-secondary rounded-md',
    pending: 'bg-surface-highest text-on-surface-variant rounded-md',
    failed: 'bg-tertiary-container text-on-surface-variant rounded-md',
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
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-container text-primary">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-on-surface">Dispatch Console</h1>
              <p className="font-body text-sm text-on-surface-variant">Send tasks to your agent swarm</p>
            </div>
          </div>
          {/* Connection status */}
          <div
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium ${
              connected
                ? 'bg-primary-container text-primary'
                : 'bg-surface-highest text-on-surface-variant opacity-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-primary' : 'bg-on-surface-variant'
              }`}
            />
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>

        {/* Input box — tonal nesting, no border at rest */}
        <div className="bg-surface-high rounded-md p-4">
          <textarea
            ref={inputRef}
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe the task or goal..."
            rows={3}
            className="w-full resize-none rounded-md bg-surface-highest font-mono text-on-surface placeholder:text-on-surface-variant px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary/40 border border-outline-variant/20"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative">
              {/* Agent selector — bg-surface-high, no border */}
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-md bg-surface-high text-on-surface px-3 py-2 text-xs hover:bg-surface-bright transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
                {AGENTS.find((a) => a.value === agent)?.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </button>
              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-md bg-surface-high py-1">
                  {AGENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => { setAgent(a.value); setDropdownOpen(false); }}
                      className={`block w-full px-4 py-2 text-left text-xs transition hover:bg-surface-bright ${
                        agent === a.value ? 'text-primary' : 'text-on-surface-variant'
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
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-on-primary px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch
            </button>
          </div>
          <p className="mt-2 text-right font-data text-[11px] text-on-surface-variant opacity-50">Cmd+Enter to dispatch</p>
        </div>

        {/* Recent commands — tonal nesting on bg-surface-low */}
        <div className="mt-8 rounded-md bg-surface-low p-4">
          <h2 className="label-sm mb-3 text-on-surface-variant">Recent Commands</h2>
          {commands.length === 0 && (
            <div
              className="rounded-md py-12 text-center font-body text-sm text-on-surface-variant opacity-50 border border-outline-variant/20"
            >
              No commands yet. Type a task above to get started.
            </div>
          )}
          <div className="space-y-2">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="rounded-md bg-surface-base hover:bg-surface-high px-4 py-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 font-mono text-sm text-on-surface break-words">{cmd.command}</p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(cmd.status)}`}
                  >
                    <StatusIcon status={cmd.status} />{cmd.status}
                  </span>
                </div>
                {cmd.result && (
                  <div className="mt-2 rounded-sm bg-surface-high px-3 py-2 font-mono text-xs text-on-surface-variant">
                    {typeof cmd.result === 'string' ? cmd.result : JSON.stringify(cmd.result)}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3 font-data text-[11px] text-on-surface-variant opacity-50">
                  <span>{relativeTime(cmd.created_at)}</span>
                  {cmd.payload?.agent && (
                    <span className="rounded-sm bg-surface-high px-1.5 py-0.5 opacity-80">
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
