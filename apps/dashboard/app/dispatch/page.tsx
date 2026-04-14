'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Send, Wifi, WifiOff, ChevronDown, Clock,
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

function statusColor(s: Command['status']) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    running: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return map[s];
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
            <Terminal className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Dispatch Console</h1>
            <p className="text-sm text-slate-500">Send tasks to your agent swarm</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connected ? 'Connected' : 'Offline'}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <textarea ref={inputRef} value={commandText} onChange={(e) => setCommandText(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Describe the task or goal..." rows={3}
          className="w-full resize-none rounded-lg border border-slate-700/60 bg-[#09090B] px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30" />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-[#09090B] px-3 py-2 text-xs text-slate-300 transition hover:border-slate-600">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              {AGENTS.find((a) => a.value === agent)?.label}
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-slate-700/60 bg-slate-900 py-1 shadow-xl">
                {AGENTS.map((a) => (
                  <button key={a.value} onClick={() => { setAgent(a.value); setDropdownOpen(false); }}
                    className={`block w-full px-4 py-2 text-left text-xs transition hover:bg-slate-800 ${agent === a.value ? 'text-indigo-400' : 'text-slate-300'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={dispatch} disabled={dispatching || !commandText.trim() || !connected}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40">
            {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Dispatch
          </button>
        </div>
        <p className="mt-2 text-right text-[11px] text-slate-600">Cmd+Enter to dispatch</p>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-slate-400">Recent Commands</h2>
        {commands.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-800 py-12 text-center text-sm text-slate-600">
            No commands yet. Type a task above to get started.
          </div>
        )}
        <div className="space-y-2">
          {commands.map((cmd) => (
            <div key={cmd.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition hover:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 text-sm text-slate-200 break-words">{cmd.command}</p>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor(cmd.status)}`}>
                  <StatusIcon status={cmd.status} />{cmd.status}
                </span>
              </div>
              {cmd.result && <div className="mt-2 rounded-lg bg-[#09090B] px-3 py-2 font-mono text-xs text-slate-400">{typeof cmd.result === 'string' ? cmd.result : JSON.stringify(cmd.result)}</div>}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
                <span>{relativeTime(cmd.created_at)}</span>
                {cmd.payload?.agent && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-500">{String(cmd.payload.agent)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
