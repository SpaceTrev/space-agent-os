'''Space-Claw Heartbeat Engine -- Orchestrator Tier

Responsibilities:
  - Poll TASKS.md every 30 minutes and surface URGENT/HIGH items
  - Post heartbeat summaries to Discord channel
  - Push actionable tasks to the Worker asyncio.Queue
  - Write last-heartbeat timestamp into TASKS.md footer
  - Integration stubs for Gmail

Environment vars:
  HEARTBEAT_INTERVAL    polling interval in seconds (default 1800)
  LOG_LEVEL             structlog level (default INFO)
  DISCORD_TOKEN         Discord bot token (preferred) or DISCORD_BOT_TOKEN
  DISCORD_GUILD_ID      Discord guild/server ID
  DISCORD_CHANNEL_ID    Discord channel ID to post heartbeat summaries
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
DISCORD_TOKEN: str = os.getenv('DISCORD_TOKEN') or os.getenv('DISCORD_BOT_TOKEN', '')
DISCORD_GUILD_ID: str = os.getenv('DISCORD_GUILD_ID', '')
DISCORD_CHANNEL_ID: str = os.getenv('DISCORD_CHANNEL_ID', '')
DISCORD_API_BASE = 'https://discord.com/api/v10'

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


# ---------------------------------------------------------------------------
# Discord REST notification (no bot process required — pure REST)
# ---------------------------------------------------------------------------

async def notify_discord(message: str) -> None:
    '''Post a heartbeat summary to the configured Discord channel via REST API.'''
    if not DISCORD_TOKEN or not DISCORD_CHANNEL_ID:
        log.debug('discord.skip', reason='DISCORD_TOKEN or DISCORD_CHANNEL_ID not set')
        return
    url = f'{DISCORD_API_BASE}/channels/{DISCORD_CHANNEL_ID}/messages'
    headers = {'Authorization': f'Bot {DISCORD_TOKEN}', 'Content-Type': 'application/json'}
    # Split long messages into 2000-char chunks (Discord limit)
    chunks = [message[i:i + 1900] for i in range(0, max(len(message), 1), 1900)]
    try:
        async with httpx.AsyncClient() as client:
            for chunk in chunks:
                resp = await client.post(url, headers=headers, json={'content': chunk}, timeout=10.0)
                if resp.status_code not in (200, 201):
                    log.warning('discord.post_failed', status=resp.status_code, body=resp.text[:200])
                else:
                    log.debug('discord.posted', channel_id=DISCORD_CHANNEL_ID, chars=len(chunk))
    except httpx.ConnectError:
        log.warning('discord.unreachable')
    except Exception as exc:
        log.error('discord.error', error=str(exc))


# ---------------------------------------------------------------------------
# Channel stubs
# ---------------------------------------------------------------------------

async def fetch_urgent_gmail() -> list[dict[str, Any]]:
    '''TODO: fetch unread URGENT-labelled Gmail via MCP gmail tool.'''
    log.debug('gmail.stub', reason='not yet wired')
    return []


# ---------------------------------------------------------------------------
# Discord summary builder
# ---------------------------------------------------------------------------

def _build_discord_summary(
    ts: str,
    tasks: list[dict[str, str]],
    urgent: list[dict[str, str]],
) -> str:
    '''Build a heartbeat summary string for posting to Discord.'''
    lines = [f'**💓 Heartbeat** `{ts}`']
    lines.append(f'Tasks total: **{len(tasks)}** | Urgent/High: **{len(urgent)}**')
    if urgent:
        lines.append('\n🔴 **Action required:**')
        for t in urgent[:5]:
            priority_emoji = '🚨' if t['priority'] == 'URGENT' else '🔶'
            lines.append(f'{priority_emoji} [{t["priority"]}] {t["description"][:80]}')
        if len(urgent) > 5:
            lines.append(f'…and {len(urgent) - 5} more.')
    return '\n'.join(lines)


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
        while not self._stop_event.is_set():
            try:
                await self._tick()
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

    async def _tick(self) -> None:
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

        # --- push urgent tasks to worker queue ---
        for i, task in enumerate(urgent):
            await self._queue.put({
                'id': f'heartbeat-{ts}-{i}',
                'description': task['description'],
                'priority': task['priority'],
                'tags': ['heartbeat'],
            })

        # --- Gmail stub ---
        await fetch_urgent_gmail()

        # --- notify Discord ---
        discord_summary = _build_discord_summary(ts, tasks, urgent)
        await notify_discord(discord_summary)

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
