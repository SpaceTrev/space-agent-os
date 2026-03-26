'''Space-Claw Worker Agent -- Worker Tier

Receives task dicts from heartbeat.py via asyncio.Queue and streams
completions from Ollama (qwen3-coder:30b-a3b).

Usage:
    python -m agents.worker          # smoke-test with sample task

Config (env vars):
    OLLAMA_BASE_URL   default http://localhost:11434
    WORKER_MODEL      default qwen3-coder:30b-a3b
    MAX_CONCURRENCY   default 3
    OLLAMA_NUM_PARALLEL  number of parallel sequences Ollama can process (default 4)
    LOG_LEVEL         default INFO
'''
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

REPO_ROOT = Path(__file__).parent.parent
AUDIT_LOG = REPO_ROOT / 'logs' / 'audit.jsonl'
OLLAMA_BASE_URL: str = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
WORKER_MODEL: str = os.getenv('WORKER_MODEL', 'qwen3-coder:30b-a3b')
MAX_CONCURRENCY: int = int(os.getenv('MAX_CONCURRENCY', '3'))
OLLAMA_NUM_PARALLEL: int = int(os.getenv('OLLAMA_NUM_PARALLEL', '4'))

SYSTEM_PROMPT = (
    'You are Space-Claw Worker, an autonomous coding assistant. '
    'Complete the requested task concisely and precisely. '
    'Output only the result -- no preamble.'
)


# ---------------------------------------------------------------------------
# Ollama streaming
# ---------------------------------------------------------------------------

async def stream_ollama(
    prompt: str,
    *,
    model: str = WORKER_MODEL,
    client: httpx.AsyncClient,
) -> AsyncIterator[str]:
    '''Stream tokens from Ollama /api/generate endpoint.'''
    payload = {
        'model': model,
        'prompt': prompt,
        'system': SYSTEM_PROMPT,
        'stream': True,
        'options': {'num_parallel': OLLAMA_NUM_PARALLEL},
    }
    async with client.stream('POST', '/api/generate', json=payload, timeout=120.0) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            token = data.get('response', '')
            if token:
                yield token
            if data.get('done'):
                break


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------

def append_audit(record: dict[str, Any]) -> None:
    '''Append a JSONL record to logs/audit.jsonl, creating dirs if needed.'''
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_LOG.open('a', encoding='utf-8') as fh:
        fh.write(json.dumps(record) + '\n')


# ---------------------------------------------------------------------------
# WorkerAgent
# ---------------------------------------------------------------------------

class WorkerAgent:
    '''Consumes tasks from a queue and streams Ollama completions.'''

    def __init__(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._queue = queue
        self._sem = asyncio.Semaphore(MAX_CONCURRENCY)
        self._running = True

    def stop(self) -> None:
        '''Signal worker to stop after draining the current queue.'''
        self._running = False

    async def run(self) -> None:
        '''Process tasks until stopped and queue is empty.'''
        log.info('worker.started', model=WORKER_MODEL, max_concurrency=MAX_CONCURRENCY)
        async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
            while self._running or not self._queue.empty():
                try:
                    task = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                asyncio.create_task(self._handle(task, client))
        log.info('worker.stopped')

    async def _handle(
        self,
        task: dict[str, Any],
        client: httpx.AsyncClient,
    ) -> None:
        '''Handle a single task under the concurrency semaphore.'''
        async with self._sem:
            await self.run_task(task, client)
        self._queue.task_done()

    async def run_task(
        self,
        task: dict[str, Any],
        client: httpx.AsyncClient,
    ) -> str:
        '''Stream a task through Ollama; append to audit.jsonl; return full text.'''
        task_id: str = task.get('id', '')
        description: str = task.get('description', '')
        priority: str = task.get('priority', 'NORMAL')
        tags: list[str] = task.get('tags', [])

        log.info(
            'worker.task_start',
            task_id=task_id,
            priority=priority,
            description=description[:80],
        )

        started_at = time.monotonic()
        ts = datetime.now(timezone.utc).isoformat()

        tokens: list[str] = []
        error: str | None = None
        try:
            async for token in stream_ollama(description, client=client):
                tokens.append(token)
        except Exception as exc:
            error = str(exc)
            log.error('worker.task_error', task_id=task_id, error=error)

        elapsed = round(time.monotonic() - started_at, 3)
        result = ''.join(tokens)

        append_audit({
            'ts': ts,
            'task_id': task_id,
            'priority': priority,
            'tags': tags,
            'description': description,
            'model': WORKER_MODEL,
            'elapsed_s': elapsed,
            'output_chars': len(result),
            'error': error,
        })

        log.info('worker.task_done', task_id=task_id, elapsed_s=elapsed, chars=len(result))
        return result


# ---------------------------------------------------------------------------
# Entry point / smoke test
# ---------------------------------------------------------------------------

async def main() -> None:
    '''Smoke-test: push one sample task and run the worker until queue drains.'''
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    agent = WorkerAgent(queue)

    sample: dict[str, Any] = {
        'id': 'smoke-001',
        'description': 'Print hello world in Python in one line.',
        'priority': 'NORMAL',
        'tags': ['smoke-test'],
    }
    await queue.put(sample)
    agent.stop()  # stop after draining current queue
    await agent.run()


if __name__ == '__main__':
    asyncio.run(main())
