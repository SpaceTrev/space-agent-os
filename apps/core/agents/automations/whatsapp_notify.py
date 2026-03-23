'''Space-Claw WhatsApp outbound notifier.

POSTs a message to the OpenClaw gateway so it appears as an outbound
WhatsApp message to the configured contact.

The endpoint path is discovered in order:
  1. OPENCLAW_NOTIFY_PATH env var (explicit override)
  2. ~/.openclaw/openclaw.json → notify_path key
  3. Fallback: /api/notify

Environment vars:
  OPENCLAW_URL          base URL (default http://localhost:18789)
  OPENCLAW_TOKEN        Bearer token
  OPENCLAW_NOTIFY_PATH  override endpoint path (e.g. /api/send)
'''
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

_DEFAULT_URL = 'http://localhost:18789'
_DEFAULT_PATH = '/api/notify'
_CONFIG_FILE = Path.home() / '.openclaw' / 'openclaw.json'


def _discover_notify_path() -> str:
    '''Return the endpoint path for outbound notifications.'''
    env_path = os.getenv('OPENCLAW_NOTIFY_PATH')
    if env_path:
        return env_path
    if _CONFIG_FILE.exists():
        try:
            cfg = json.loads(_CONFIG_FILE.read_text(encoding='utf-8'))
            path = cfg.get('notify_path')
            if path:
                log.debug('whatsapp_notify.config_path', path=path)
                return path
        except (json.JSONDecodeError, OSError) as exc:
            log.warning('whatsapp_notify.config_error', error=str(exc))
    return _DEFAULT_PATH


async def notify(message: str) -> None:
    '''Send an outbound WhatsApp message via the OpenClaw gateway.

    Silently logs and returns on non-fatal errors (connection refused, etc.)
    so that a broken gateway never crashes the calling agent.
    '''
    base_url = os.getenv('OPENCLAW_URL', _DEFAULT_URL)
    token = os.getenv('OPENCLAW_TOKEN', '')
    path = _discover_notify_path()

    if not token:
        log.warning('whatsapp_notify.skip', reason='OPENCLAW_TOKEN not set')
        return

    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    payload = {'message': message}

    log.info('whatsapp_notify.sending', url=f'{base_url}{path}', chars=len(message))
    try:
        async with httpx.AsyncClient(base_url=base_url) as client:
            resp = await client.post(path, json=payload, headers=headers, timeout=10.0)
            resp.raise_for_status()
            log.info('whatsapp_notify.sent', status=resp.status_code)
    except httpx.ConnectError:
        log.warning('whatsapp_notify.unreachable', url=base_url)
    except httpx.HTTPStatusError as exc:
        log.error('whatsapp_notify.http_error', status=exc.response.status_code)
    except Exception as exc:
        log.error('whatsapp_notify.error', error=str(exc))
