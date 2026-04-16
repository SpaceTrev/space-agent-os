// apps/dashboard/app/agents/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Agent Chat — Space Agent OS",
  description: "Communicate with your autonomous agent swarm",
};

export default function AgentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      {children}
    </div>
  );
}
