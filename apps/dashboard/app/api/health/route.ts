// GET /api/health — public system status endpoint, no auth required
export function GET() {
  return Response.json({
    status: 'online',
    system: 'Space-Agent-OS',
    persona: 'Space-Claw',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    agents_total: 9,
    model_tiers: 4,
    brain_domains: 6,
    deployment: 'vercel',
  })
}
