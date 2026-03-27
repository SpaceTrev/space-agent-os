'''Space-Claw Pipeline Engine -- Sequential agent step chaining.

A Pipeline runs a list of PipelineSteps in order. Each step's output
is injected into the next step's prompt template as context via str.format().

Supported tiers:
  orchestrator  → Llama 3.3 8B via Ollama (fast, local, free)
  worker        → Qwen3-Coder 30B via Ollama (code, logic)
  architect     → Claude claude-sonnet-4-6 via Anthropic API (deep reasoning)

Usage:
    step = PipelineStep(name='plan', agent_tier='architect',
                        prompt_template='Plan: {input}', output_key='plan')
    result = await Pipeline([step]).run('Build a REST API')
'''
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

OLLAMA_BASE_URL: str = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
ORCHESTRATOR_MODEL: str = os.getenv('ORCHESTRATOR_MODEL', 'llama3.3:8b')
WORKER_MODEL: str = os.getenv('WORKER_MODEL', 'qwen3-coder:30b-a3b')
ARCHITECT_MODEL: str = os.getenv('ARCHITECT_MODEL', 'claude-sonnet-4-6')


# ─── Data models ─────────────────────────────────────────────────────────────


@dataclass
class PipelineStep:
    '''A single step in a pipeline.

    prompt_template is formatted with the current context dict, which always
    contains at minimum {"input": <previous output or initial input>} plus
    all prior steps' output_key → value pairs.
    '''
    name: str
    agent_tier: str  # 'orchestrator' | 'worker' | 'architect'
    prompt_template: str
    output_key: str
    system_prompt: str = ''


@dataclass
class PipelineResult:
    '''Outcome of a full pipeline run.'''
    success: bool
    step_outputs: dict[str, str] = field(default_factory=dict)
    final_output: str = ''
    error: str | None = None


# ─── Low-level model callers ──────────────────────────────────────────────────


async def _call_ollama(
    model: str,
    prompt: str,
    *,
    system_prompt: str = '',
) -> str:
    '''POST to Ollama /api/generate (non-streaming).'''
    payload: dict[str, Any] = {'model': model, 'prompt': prompt, 'stream': False}
    if system_prompt:
        payload['system'] = system_prompt
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
        resp = await client.post('/api/generate', json=payload, timeout=180.0)
        resp.raise_for_status()
        return resp.json().get('response', '')


async def _call_anthropic(prompt: str, *, system_prompt: str = '') -> str:
    '''Call Claude via Anthropic SDK (lazy import — only used for architect tier).'''
    import anthropic  # noqa: PLC0415
    client = anthropic.AsyncAnthropic()
    kwargs: dict[str, Any] = {
        'model': ARCHITECT_MODEL,
        'max_tokens': 8096,
        'messages': [{'role': 'user', 'content': prompt}],
    }
    if system_prompt:
        kwargs['system'] = system_prompt
    message = await client.messages.create(**kwargs)
    return message.content[0].text


# ─── Public tier dispatcher ───────────────────────────────────────────────────


async def call_tier(
    tier: str,
    prompt: str,
    *,
    system_prompt: str = '',
) -> str:
    '''Call the appropriate model tier and return the response text.

    Args:
        tier: 'orchestrator', 'worker', or 'architect'
        prompt: The full prompt to send.
        system_prompt: Optional system-level instruction.

    Returns:
        Model response as a string.
    '''
    if tier == 'architect':
        log.debug('call_tier', tier='architect', model=ARCHITECT_MODEL)
        return await _call_anthropic(prompt, system_prompt=system_prompt)
    model = WORKER_MODEL if tier == 'worker' else ORCHESTRATOR_MODEL
    log.debug('call_tier', tier=tier, model=model)
    return await _call_ollama(model, prompt, system_prompt=system_prompt)


# ─── Pipeline ─────────────────────────────────────────────────────────────────


class Pipeline:
    '''Runs PipelineSteps sequentially, threading each output into the next.

    Context starts as {"input": initial_input} and grows with each step's
    output_key. The prompt_template for each step can reference any prior key.
    '''

    def __init__(self, steps: list[PipelineStep]) -> None:
        self.steps = steps

    async def run(self, initial_input: str) -> PipelineResult:
        '''Execute all steps in order.

        Args:
            initial_input: The seed value for {input} in the first step.

        Returns:
            PipelineResult with all step outputs and the final output.
        '''
        context: dict[str, str] = {'input': initial_input}
        step_outputs: dict[str, str] = {}

        for step in self.steps:
            try:
                prompt = step.prompt_template.format(**context)
            except KeyError as exc:
                return PipelineResult(
                    success=False,
                    step_outputs=step_outputs,
                    error=f'Missing template key {exc} in step "{step.name}"',
                )

            log.info('pipeline.step_start', step=step.name, tier=step.agent_tier)
            try:
                output = await call_tier(
                    step.agent_tier,
                    prompt,
                    system_prompt=step.system_prompt,
                )
            except Exception as exc:
                log.error('pipeline.step_error', step=step.name, error=str(exc))
                return PipelineResult(
                    success=False,
                    step_outputs=step_outputs,
                    error=str(exc),
                )

            step_outputs[step.output_key] = output
            context[step.output_key] = output
            context['input'] = output  # chain: each step's output feeds the next
            log.info('pipeline.step_done', step=step.name, chars=len(output))

        final = step_outputs.get(self.steps[-1].output_key, '') if self.steps else ''
        return PipelineResult(success=True, step_outputs=step_outputs, final_output=final)
