'''Space-Claw Pipeline Engine

Composable multi-step LLM pipeline with model-tier routing.

Each PipelineStep declares its tier (ORCHESTRATOR / WORKER / ARCHITECT),
a prompt template with {input} and {context} placeholders, and an output_key
used to store results for downstream steps.

Environment vars:
  OLLAMA_BASE_URL      default http://localhost:11434
  ORCHESTRATOR_MODEL   default llama3.3:8b
  WORKER_MODEL         default qwen3-coder:30b-a3b
  ANTHROPIC_API_KEY    required for ARCHITECT tier
'''
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from enum import Enum
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


class ModelTier(str, Enum):
    ORCHESTRATOR = 'orchestrator'  # Ollama llama3.3:8b  — routing, triage
    WORKER = 'worker'              # Ollama qwen3-coder:30b-a3b — code, logic
    ARCHITECT = 'architect'        # Anthropic claude-sonnet-4-6 — deep reasoning


@dataclass
class PipelineStep:
    '''A single step in a pipeline.

    Args:
        name:            Human-readable label for logging.
        model_tier:      Which model to use (ORCHESTRATOR/WORKER/ARCHITECT).
        prompt_template: Jinja-free template — uses {input} and {context} as
                         string-format placeholders.
        output_key:      Key under which this step's output is stored so later
                         steps can reference it via {context}.
        system_prompt:   Optional system instruction prepended to the prompt.
    '''
    name: str
    model_tier: ModelTier
    prompt_template: str
    output_key: str
    system_prompt: str = ''


@dataclass
class PipelineResult:
    success: bool
    outputs: dict[str, str] = field(default_factory=dict)
    final_output: str = ''
    error: str | None = None


# ---------------------------------------------------------------------------
# Low-level model calls
# ---------------------------------------------------------------------------

async def _call_ollama(
    prompt: str,
    model: str,
    system_prompt: str = '',
    client: httpx.AsyncClient | None = None,
) -> str:
    '''Stream a completion from Ollama and return the full text.'''
    payload: dict[str, Any] = {
        'model': model,
        'prompt': prompt,
        'stream': True,
    }
    if system_prompt:
        payload['system'] = system_prompt

    async def _stream(c: httpx.AsyncClient) -> str:
        tokens: list[str] = []
        async with c.stream('POST', '/api/generate', json=payload, timeout=180.0) as resp:
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
                    tokens.append(token)
                if data.get('done'):
                    break
        return ''.join(tokens)

    if client is not None:
        return await _stream(client)
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as c:
        return await _stream(c)


async def _call_anthropic(prompt: str, system_prompt: str = '') -> str:
    '''Call Anthropic claude-sonnet-4-6 and return the full text.'''
    try:
        import anthropic  # lazy import — only required for ARCHITECT tier
    except ImportError as exc:
        raise RuntimeError(
            'anthropic SDK not installed. Run: uv add anthropic'
        ) from exc

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise RuntimeError('ANTHROPIC_API_KEY env var is not set')

    client = anthropic.AsyncAnthropic(api_key=api_key)
    kwargs: dict[str, Any] = {
        'model': 'claude-sonnet-4-6',
        'max_tokens': 8192,
        'messages': [{'role': 'user', 'content': prompt}],
    }
    if system_prompt:
        kwargs['system'] = system_prompt

    message = await client.messages.create(**kwargs)
    return message.content[0].text


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

class Pipeline:
    '''Runs a sequence of PipelineSteps, threading outputs through as context.

    Usage::

        pipeline = Pipeline([step1, step2, step3])
        result = await pipeline.run("initial user request")
    '''

    def __init__(self, steps: list[PipelineStep]) -> None:
        if not steps:
            raise ValueError('Pipeline requires at least one step')
        self._steps = steps

    async def run(self, initial_input: str) -> PipelineResult:
        '''Execute all steps in sequence and return a PipelineResult.'''
        outputs: dict[str, str] = {}
        current_input = initial_input

        for i, step in enumerate(self._steps):
            log.info(
                'pipeline.step_start',
                step=step.name,
                tier=step.model_tier.value,
                index=i,
            )
            context_repr = {k: v[:200] for k, v in outputs.items()}
            try:
                prompt = step.prompt_template.format(
                    input=current_input,
                    context=context_repr,
                )
            except KeyError as exc:
                return PipelineResult(
                    success=False,
                    outputs=outputs,
                    error=f'Step "{step.name}" prompt_template missing key: {exc}',
                )

            try:
                output = await self._call_step(step, prompt)
            except Exception as exc:
                log.error('pipeline.step_error', step=step.name, error=str(exc))
                return PipelineResult(
                    success=False,
                    outputs=outputs,
                    error=f'Step "{step.name}" failed: {exc}',
                )

            outputs[step.output_key] = output
            current_input = output
            log.info(
                'pipeline.step_done',
                step=step.name,
                output_chars=len(output),
            )

        return PipelineResult(
            success=True,
            outputs=outputs,
            final_output=current_input,
        )

    async def _call_step(self, step: PipelineStep, prompt: str) -> str:
        '''Dispatch to the correct backend based on model tier.'''
        if step.model_tier == ModelTier.ARCHITECT:
            return await _call_anthropic(prompt, step.system_prompt)
        model = (
            ORCHESTRATOR_MODEL
            if step.model_tier == ModelTier.ORCHESTRATOR
            else WORKER_MODEL
        )
        return await _call_ollama(prompt, model, step.system_prompt)
