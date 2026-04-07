---
type: decision
status: decided
project: "[[projects/space-agent-os/context]]"
decided_by: [trev]
date: "2026-03-26"
tags: [architecture, brain, context]
created: "2026-04-06"
updated: "2026-04-06"
---

# Three-Level Brain System

## Context
Agents need project context injected before they start work. The question was how to deliver that context — vector DB retrieval (RAG) vs. deterministic file loading.

## Options Considered
1. **Vector DB (ChromaDB/Pinecone)** — embed all docs, semantic search at query time. Flexible but non-deterministic — you can't guarantee what context the agent gets.
2. **Flat file loading** — load specific files based on task metadata. Deterministic but requires manual curation.
3. **Three-level hierarchical brain** — company → department → project brains loaded in order, always in context. Combines determinism with broad coverage.

## Decision
Option 3 — three-level hierarchical brain. Company brain loads for every agent. Department brain loads based on agent role. Project brain loads based on the task's project tag.

## Consequences
- Context is always predictable — same inputs produce same context window
- Brain files must be kept current (stale context = stale agents)
- No semantic search capability (trade-off accepted for simplicity)
- Scales linearly with file count, not with embedding costs

## Related
- [[projects/space-agent-os/context]]
- [[people/trev]]
