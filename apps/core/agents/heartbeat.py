'''Space-Claw Heartbeat Engine -- Orchestrator Tier

Responsibilities:
  - Poll TASKS.md every 30 minutes and surface URGENT/HIGH items
  - Check incoming WhatsApp messages from OpenClaw gateway
  - Push actionable tasks to the Worker asyncio.Queue
  - Write last-heartbeat timestamp into TASKS.md footer
  - Integration stubs for Gmail, WhatsApp, and Discord

Environment vars:
  OPENCLAW_GATEWAY_URL  URL for the OpenClaw gateway (default: http://localhost:18789)
  OPENCLAW_TOKEN        Bearer token for OpenClaw API
  HEARTBEAT_INTERVAL    polling interval in seconds (default 1800)
  LOG_LEVEL             structlog level (default INFO)
  DISCORD_BOT_TOKEN     Discord bot token
  DISCORD_GUILD_ID      Discord guild/server ID
  DISCORD_CHANNEL_ID    Discord channel ID to monitor
'''
from __future__ import annotations

import asyncio
import logging
import os
import re
import signal
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

REPO_ROOT = Path(__file__).parent.parent
TASKS_FILE = REPO_ROOT / 'TASKS.md'
POLL_INTERVAL_SECONDS: int = int(os.getenv('HEARTBEAT_INTERVAL', '1800'))
OPENCLAW_GATEWAY_URL: str = os.getenv('OPENCLAW_GATEWAY_URL', 'http://localhost:18789')
OPENCLAW_TOKEN: str = os.getenv('OPENCLAW_TOKEN', '')
DISCORD_BOT_TOKEN: str = os.getenv('DISCORD_BOT_TOKEN', '')
DISCORD_GUILD_ID: str = os.getenv('DISCORD_GUILD_ID', '')
DISCORD_CHANNEL_ID: str = os.getenv('DISCORD_CHANNEL_ID', '')

PRIORITY_RE = re.compile(
    r'^\s*-\s+\[(?P<priority>URGENT|HIGH|NORMAL|LOW)\]\s+(?P<description>.+)$'
)


def parse_tasks(content: str) -> list[dict[str, str]]:
    '''Parse TASKS.md and return task dicts with priority + description.'''
    tasks: list[dict[str, str]] = []
    for line in content.splitlines():
        m = PRIORITY_RE.match(line)
        if m:
            tasks.append({
                'priority': m.group('priority'),
                'description': m.group('description').strip(),
            })
    return tasks


def update_heartbeat_timestamp(content: str, ts: str) -> str:
    '''Upsert the *Last heartbeat* footer line in TASKS.md.'''
    marker = '*Last heartbeat:'
    new_line = f'*Last heartbeat: {ts}*'
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith(marker):
            lines[i] = new_line
            return '\n'.join(lines) + '\n'
    return content.rstrip() + f'\n\n---\n{new_line}\n'


async def fetch_whatsapp_messages(
    client: httpx.AsyncClient,
) -> list[dict[str, Any]]:
    '''Poll the OpenClaw gateway: GET /api/messages with Bearer token.'''
    if not OPENCLAW_TOKEN:
        log.debug('whatsapp.skip', reason='OPENCLAW_TOKEN not set')
        return []
    try:
        resp = await client.get(
            '/api/messages',
            headers={'Authorization': f'Bearer {OPENCLAW_TOKEN}'},
            timeout=5.0,
        )
        resp.raise_for_status()
        return resp.json().get('messages', [])
    except httpx.ConnectError:
        log.warning('whatsapp.unreachable', url=OPENCLAW_GATEWAY_URL)
        return []
    except httpx.HTTPStatusError as exc:
        log.error('whatsapp.http_error', status=exc.response.status_code)
        return []



# ---------------------------------------------------------------------------
# Channel stubs -- wired up when tokens are present
# ---------------------------------------------------------------------------

async def fetch_urgent_gmail(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    '''TODO: fetch unread URGENT-labelled Gmail via MCP gmail tool.

    Placeholder -- returns empty list until Gmail MCP is connected.
    '''
    log.debug('gmail.stub', reason='not yet wired')
    return []


async def dispatch_whatsapp_commands(
    messages: list[dict[str, Any]],
    queue: asyncio.Queue[dict[str, Any]],
) -> None:
    '''Parse incoming WhatsApp messages and push actionable tasks to the queue.

    TODO: implement command parser (e.g. !task <description>).
    '''
    for msg in messages:
        body: str = msg.get('body', '')
        if body.startswith('!task '):
            description = body[len('!task '):].strip()
            if description:
                await queue.put({
                    'id': msg.get('id', ''),
                    'description': description,
                    'priority': 'HIGH',
                    'tags': ['whatsapp'],
                })
                log.info('whatsapp.task_queued', description=description)


async def notify_discord(message: str) -> None:
    '''Post a message to the configured Discord channel via REST.

    Uses DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CHANNEL_ID env vars.
    TODO: replace stub with full discord.py or httpx implementation.
    '''
    if not DISCORD_BOT_TOKEN or not DISCORD_CHANNEL_ID:
        log.debug('discord.skip', reason='DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID not set')
        return
    log.debug('discord.stub', channel_id=DISCORD_CHANNEL_ID, message=message[:80])


# ---------------------------------------------------------------------------
# HeartbeatEngine
# ---------------------------------------------------------------------------

class HeartbeatEngine:
    '''Polls TASKS.md, checks channels, stamps footer, pushes urgent work.'''

    def __init__(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._queue = queue
        self._stop_event = asyncio.Event()

    def stop(self) -> None:
        '''Signal the engine to stop after the current tick.'''
        log.info('heartbeat.stopping')
        self._stop_event.set()

    async def run(self) -> None:
        '''Main loop: tick every POLL_INTERVAL_SECONDS until stopped.'''
        log.info('heartbeat.started', interval_s=POLL_INTERVAL_SECONDS)
        async with httpx.AsyncClient(base_url=OPENCLAW_GATEWAY_URL) as client:
            while not self._stop_event.is_set():
                try:
                    await self._tick(client)
                except Exception:
                    log.exception('heartbeat.tick_error')
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=float(POLL_INTERVAL_SECONDS),
                    )
                except asyncio.TimeoutError:
                    pass
        log.info('heartbeat.stopped')

    async def _tick(self, client: httpx.AsyncClient) -> None:
        '''Single heartbeat cycle.'''
        ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        log.info('heartbeat.tick', ts=ts)

        # --- read TASKS.md ---
        content = TASKS_FILE.read_text(encoding='utf-8')
        tasks = parse_tasks(content)

        urgent = [t for t in tasks if t['priority'] in ('URGENT', 'HIGH')]
        if urgent:
            log.warning(
                'heartbeat.urgent_tasks',
                count=len(urgent),
                tasks=[t['description'][:60] for t in urgent[:5]],
            )

        # --- poll WhatsApp ---
        wa_messages = await fetch_whatsapp_messages(client)
        if wa_messages:
            log.info('whatsapp.messages', count=len(wa_messages))
            await dispatch_whatsapp_commands(wa_messages, self._queue)

        # --- Gmail stub ---
        await fetch_urgent_gmail(client)

        # --- stamp footer ---
        updated = update_heartbeat_timestamp(content, ts)
        TASKS_FILE.write_text(updated, encoding='utf-8')
        log.debug('heartbeat.stamped', ts=ts)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    '''Bootstrap heartbeat engine with shared asyncio.Queue and signal handlers.'''
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    engine = HeartbeatEngine(queue)

    loop = asyncio.get_running_loop()

    def _handle_signal() -> None:
        log.info('signal.received')
        engine.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_signal)

    log.info('heartbeat.main', tasks_file=str(TASKS_FILE))
    await engine.run()


if __name__ == '__main__':
    asyncio.run(main())
