// ============================================================
// Agent OS — In-Memory Task Queue
// Simple queue for task execution. Replace with Trigger.dev
// or a proper job queue for production use.
// ============================================================

import { runTask } from '@/lib/runner'

// ============================================================
// Queue Entry
// ============================================================

interface QueueEntry {
  taskId: string
  addedAt: Date
  attempts: number
}

// ============================================================
// Queue State (module-level singleton)
// ============================================================

const queue: QueueEntry[] = []
const processing = new Set<string>()
let isRunning = false

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_TASKS ?? '3', 10)
const MAX_ATTEMPTS = 3

// ============================================================
// addTask — adds a task ID to the queue
// ============================================================

export function addTask(taskId: string): void {
  // Avoid duplicates
  if (queue.some((e) => e.taskId === taskId) || processing.has(taskId)) {
    console.log(`[Queue] Task ${taskId} already in queue or processing`)
    return
  }

  queue.push({ taskId, addedAt: new Date(), attempts: 0 })
  console.log(`[Queue] Added task ${taskId}. Queue depth: ${queue.length}`)

  // Kick off processing (non-blocking)
  void processLoop()
}

// ============================================================
// processNext — runs the next task from the queue
// Returns true if a task was started, false if queue is empty
// ============================================================

export async function processNext(): Promise<boolean> {
  if (queue.length === 0) return false
  if (processing.size >= MAX_CONCURRENT) return false

  const entry = queue.shift()
  if (!entry) return false

  processing.add(entry.taskId)
  entry.attempts += 1

  console.log(`[Queue] Processing task ${entry.taskId} (attempt ${entry.attempts})`)

  try {
    await runTask(entry.taskId)
    console.log(`[Queue] Task ${entry.taskId} completed`)
  } catch (err) {
    console.error(`[Queue] Task ${entry.taskId} failed:`, err)

    // Re-queue if under max attempts
    if (entry.attempts < MAX_ATTEMPTS) {
      console.log(`[Queue] Re-queuing task ${entry.taskId} (attempt ${entry.attempts}/${MAX_ATTEMPTS})`)
      // Add back with delay via a timeout
      setTimeout(() => {
        queue.unshift(entry)
        void processLoop()
      }, 2000 * entry.attempts) // Exponential backoff
    } else {
      console.error(`[Queue] Task ${entry.taskId} exhausted retries`)
    }
  } finally {
    processing.delete(entry.taskId)
  }

  return true
}

// ============================================================
// processLoop — continuously drains the queue
// ============================================================

async function processLoop(): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    while (queue.length > 0 && processing.size < MAX_CONCURRENT) {
      const started = await processNext()
      if (!started) break
      // Small yield to avoid tight loop
      await new Promise((r) => setTimeout(r, 10))
    }
  } finally {
    isRunning = false
    // If more work appeared while we were finishing, restart
    if (queue.length > 0 && processing.size < MAX_CONCURRENT) {
      void processLoop()
    }
  }
}

// ============================================================
// getStatus — returns current queue state
// ============================================================

export interface QueueStatus {
  queued: number
  processing: number
  queuedTasks: string[]
  processingTasks: string[]
}

export function getStatus(): QueueStatus {
  return {
    queued: queue.length,
    processing: processing.size,
    queuedTasks: queue.map((e) => e.taskId),
    processingTasks: Array.from(processing),
  }
}

// ============================================================
// removeTask — removes a task from the queue (cancel)
// ============================================================

export function removeTask(taskId: string): boolean {
  const idx = queue.findIndex((e) => e.taskId === taskId)
  if (idx === -1) return false
  queue.splice(idx, 1)
  console.log(`[Queue] Removed task ${taskId} from queue`)
  return true
}

// ============================================================
// clearQueue — empties the queue (admin use)
// ============================================================

export function clearQueue(): void {
  queue.length = 0
  console.log('[Queue] Queue cleared')
}
