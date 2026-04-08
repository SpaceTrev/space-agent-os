import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mission Control — Space-Agent-OS',
  description: 'Live system status: agent roster, model tiers, and brain vault for Space-Agent-OS.',
}

export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return children
}
