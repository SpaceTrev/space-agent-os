'''Space-Claw Intent Router

Classifies incoming messages (typically from WhatsApp) into a known Intent
using the ORCHESTRATOR tier (Llama, local — zero API cost) and dispatches
to the appropriate handler.

Adding a new automation:
  1. Add an Intent variant below.
  2. Add a handler coroutine.
  3. Wire it in IntentRouter._handlers.

Environment vars:
  OLLAMA_BASE_URL      default http://localhost:11434
  ORCHESTRATOR_MODEL   default llama3.3:8b
'''
from __future__ import annotations

import logging
import os
from enum import Enum
from typing import Callable, Awaitable

import structlog

from agents.pipeline import ORCHESTRATOR_MODEL, _call_ollama

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Intent taxonomy
# ---------------------------------------------------------------------------

class Intent(str, Enum):
    DEV_TASK        = 'DEV_TASK'         # write/fix/refactor code
    DRAFT_REPLIES   = 'DRAFT_REPLIES'    # draft email / Slack replies
    SCHEDULE_SCAN   = 'SCHEDULE_SCAN'    # check calendar / next meeting
    MARKET_OVERVIEW = 'MARKET_OVERVIEW'  # market data, competitor summary
    LINEAR_TASKS    = 'LINEAR_TASKS'     # list or update Linear issues
    SOCIAL_CONTENT  = 'SOCIAL_CONTENT'   # write tweet / LinkedIn post
    GENERAL         = 'GENERAL'          # fallback


_CLASSIFICATION_SYSTEM = (
    'You are a message intent classifier. '
    'Classify the user message into exactly one of these intents:\n'
    '  DEV_TASK, DRAFT_REPLIES, SCHEDULE_SCAN, MARKET_OVERVIEW, '
    'LINEAR_TASKS, SOCIAL_CONTENT, GENERAL\n'
    'Reply with ONLY the intent name — no punctuation, no explanation.'
)

_CLASSIFICATION_TEMPLATE = 'Message: {message}\n\nIntent:'


# ---------------------------------------------------------------------------
# Default handlers
# ---------------------------------------------------------------------------

async def _handle_dev_task(message: str) -> str:
    from agents.dev_agents import DevPipeline
    result = await DevPipeline().run(message)
    if not result.success:
        return f'Dev pipeline failed: {result.error}'
    # Return a compact summary (first 1000 chars of implementation)
    impl = result.outputs.get('implementation', result.final_output)
    return f'Dev task complete.\n\n{impl[:1000]}'


async def _handle_draft_replies(message: str) -> str:
    from agents.pipeline import Pipeline, PipelineStep, ModelTier
    step = PipelineStep(
        name='draft_replies',
        model_tier=ModelTier.ARCHITECT,
        prompt_template=(
            'Draft concise, professional replies for the following:\n{input}\n'
            'Context: {context}'
        ),
        output_key='draft',
        system_prompt=(
            'You are a sharp communicator. Draft clear, concise replies. '
            'Use plain language. Match the tone of the original messages.'
        ),
    )
    result = await Pipeline([step]).run(message)
    return result.final_output if result.success else f'Error: {result.error}'


async def _handle_schedule_scan(message: str) -> str:
    # Stub — real impl would call Google Calendar MCP
    log.debug('intent.schedule_scan.stub', message=message[:80])
    return (
        'Schedule scan not yet wired to Google Calendar. '
        'To connect, add the Google Calendar MCP and update this handler.'
    )


async def _handle_market_overview(message: str) -> str:
    from agents.pipeline import Pipeline, PipelineStep, ModelTier
    step = PipelineStep(
        name='market_overview',
        model_tier=ModelTier.ARCHITECT,
        prompt_template='Provide a brief market overview for: {input}\nContext: {context}',
        output_key='overview',
        system_prompt=(
            'You are a concise market analyst. Summarise key trends, '
            'competitors, and opportunities in 3-5 bullet points.'
        ),
    )
    result = await Pipeline([step]).run(message)
    return result.final_output if result.success else f'Error: {result.error}'


async def _handle_linear_tasks(message: str) -> str:
    # Stub — real impl would call Linear MCP
    log.debug('intent.linear_tasks.stub', message=message[:80])
    return (
        'Linear integration not yet wired. '
        'To connect, add the Linear MCP and update this handler.'
    )


async def _handle_social_content(message: str) -> str:
    from agents.pipeline import Pipeline, PipelineStep, ModelTier
    step = PipelineStep(
        name='social_content',
        model_tier=ModelTier.ARCHITECT,
        prompt_template='Write social content for: {input}\nContext: {context}',
        output_key='post',
        system_prompt=(
            'You are a sharp tech founder with an authentic voice. '
            'Write punchy, insightful social posts — no corporate speak, '
            'no hashtag spam. LinkedIn and X variants if appropriate.'
        ),
    )
    result = await Pipeline([step]).run(message)
    return result.final_output if result.success else f'Error: {result.error}'


async def _handle_general(message: str) -> str:
    from agents.pipeline import Pipeline, PipelineStep, ModelTier
    step = PipelineStep(
        name='general',
        model_tier=ModelTier.ORCHESTRATOR,
        prompt_template='User message: {input}\nContext: {context}\n\nRespond helpfully.',
        output_key='response',
    )
    result = await Pipeline([step]).run(message)
    return result.final_output if result.success else f'Error: {result.error}'


# ---------------------------------------------------------------------------
# IntentRouter
# ---------------------------------------------------------------------------

Handler = Callable[[str], Awaitable[str]]

class IntentRouter:
    '''Classifies a message and dispatches to the matching automation handler.

    Usage::

        router = IntentRouter()
        intent = await router.route("Fix the auth bug in middleware.py")
        # Intent.DEV_TASK
        response = await router.dispatch("Fix the auth bug in middleware.py")
        # <implementation from DevPipeline>
    '''

    _handlers: dict[Intent, Handler] = {
        Intent.DEV_TASK:        _handle_dev_task,
        Intent.DRAFT_REPLIES:   _handle_draft_replies,
        Intent.SCHEDULE_SCAN:   _handle_schedule_scan,
        Intent.MARKET_OVERVIEW: _handle_market_overview,
        Intent.LINEAR_TASKS:    _handle_linear_tasks,
        Intent.SOCIAL_CONTENT:  _handle_social_content,
        Intent.GENERAL:         _handle_general,
    }

    async def route(self, message: str) -> Intent:
        '''Classify the message into an Intent using the ORCHESTRATOR tier.'''
        prompt = _CLASSIFICATION_TEMPLATE.format(message=message)
        raw = await _call_ollama(
            prompt=prompt,
            model=ORCHESTRATOR_MODEL,
            system_prompt=_CLASSIFICATION_SYSTEM,
        )
        raw = raw.strip().upper().split()[0] if raw.strip() else ''
        try:
            intent = Intent(raw)
        except ValueError:
            log.warning('intent_router.unknown_intent', raw=raw, fallback='GENERAL')
            intent = Intent.GENERAL
        log.info('intent_router.classified', intent=intent.value, message=message[:80])
        return intent

    async def dispatch(self, message: str) -> str:
        '''Route the message and execute its handler. Returns a response string.'''
        intent = await self.route(message)
        handler = self._handlers.get(intent, _handle_general)
        log.info('intent_router.dispatch', intent=intent.value)
        try:
            return await handler(message)
        except Exception as exc:
            log.error('intent_router.handler_error', intent=intent.value, error=str(exc))
            return f'Error processing {intent.value}: {exc}'
