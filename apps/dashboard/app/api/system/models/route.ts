// GET /api/system/models — public model tier config, no auth required
// Returns configured model tiers from the Space-Agent-OS architecture
export function GET() {
  const models = [
    {
      id: 'opus-orchestrator',
      name: 'Claude Opus 4.6',
      short_name: 'Opus',
      tier: 'orchestrator',
      provider: 'OpenClaw',
      use_case: 'All tasks — reasoning, code, planning, high-stakes decisions',
      context_window: 200000,
      mode: 'sync',
      routing_rule: 'Default for all agent tasks',
      status: 'online',
    },
    {
      id: 'qwen3-realtime',
      name: 'Qwen3-Coder 30B',
      short_name: 'qwen3-coder',
      tier: 'local',
      provider: 'Ollama',
      use_case: 'Offline work, cost-sensitive batch, privacy-sensitive code',
      context_window: 32768,
      mode: 'real-time',
      routing_rule: 'When OLLAMA_ENABLED=true or /local invocation',
      status: 'offline',
    },
    {
      id: 'gemma4-async',
      name: 'Gemma 4',
      short_name: 'gemma4',
      tier: 'secondary',
      provider: 'Google',
      use_case: 'Parallel async runs, very long context (>100k tokens)',
      context_window: 1000000,
      mode: 'async',
      routing_rule: 'Parallel runs or context > 100k tokens',
      status: 'online',
    },
    {
      id: 'codex-harness',
      name: 'Codex',
      short_name: 'codex',
      tier: 'tooling',
      provider: 'Claude Code Harness',
      use_case: 'Agentic coding tasks, file edits, repo-wide refactors',
      context_window: 200000,
      mode: 'sync',
      routing_rule: 'When running inside Claude Code agent sessions',
      status: 'online',
    },
  ]

  return Response.json({ models, total: models.length })
}
