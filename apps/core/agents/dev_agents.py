'''Space-Claw Dev Agent Pipeline

Three-stage code development pipeline:
  PlannerAgent    (ARCHITECT) → structured plan with numbered subtasks
  ImplementerAgent (WORKER)   → code blocks for each subtask
  ReviewerAgent   (ARCHITECT) → approves or requests changes

DevPipeline chains all three. If the reviewer requests changes, the
implementer retries with feedback appended (up to MAX_ITERATIONS=2).

Usage::

    pipeline = DevPipeline()
    result = await pipeline.run("Add a Redis-backed rate limiter to FastAPI")
    print(result.final_output)
'''
from __future__ import annotations

import logging
import os

import structlog

from agents.pipeline import (
    ModelTier,
    Pipeline,
    PipelineResult,
    PipelineStep,
    _call_anthropic,
    _call_ollama,
    WORKER_MODEL,
)

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

MAX_ITERATIONS = 2

# ---------------------------------------------------------------------------
# Prompt constants
# ---------------------------------------------------------------------------

_PLANNER_SYSTEM = (
    'You are a senior software architect. '
    'Break the task into numbered subtasks with clear acceptance criteria. '
    'List every file that must be created or modified. '
    'Be specific: subtasks should be actionable by a single engineer.'
)

_PLANNER_TEMPLATE = (
    'Task: {input}\n\n'
    'Previous context: {context}\n\n'
    'Produce a numbered implementation plan.'
)

_IMPLEMENTER_SYSTEM = (
    'You are an expert software engineer. '
    'Implement the given subtask fully. '
    'Output code blocks with the target file path as a comment on the first line, '
    'e.g.:\n\n'
    '```python\n# file: path/to/module.py\n<code here>\n```\n\n'
    'Cover every file in the plan. No hand-waving — write real code.'
)

_IMPLEMENTER_TEMPLATE = (
    'Implementation plan:\n{input}\n\n'
    'Context from prior steps: {context}\n\n'
    'Implement all files now.'
)

_REVIEWER_SYSTEM = (
    'You are a senior code reviewer. '
    'Review the implementation against the plan. '
    'Reply with exactly one of:\n'
    '  APPROVED: <brief note>\n'
    '  CHANGES_REQUESTED: <specific, actionable feedback>\n'
    'Do not include anything else.'
)

_REVIEWER_TEMPLATE = (
    'Plan:\n{input}\n\n'
    'Implementation context: {context}\n\n'
    'Review the implementation and respond.'
)


# ---------------------------------------------------------------------------
# Individual agents (thin wrappers over Pipeline primitives)
# ---------------------------------------------------------------------------

class PlannerAgent:
    '''ARCHITECT tier: decomposes a task into a numbered subtask plan.'''

    _step = PipelineStep(
        name='planner',
        model_tier=ModelTier.ARCHITECT,
        prompt_template=_PLANNER_TEMPLATE,
        output_key='plan',
        system_prompt=_PLANNER_SYSTEM,
    )

    async def run(self, task: str) -> str:
        result = await Pipeline([self._step]).run(task)
        if not result.success:
            raise RuntimeError(f'PlannerAgent failed: {result.error}')
        return result.outputs['plan']


class ImplementerAgent:
    '''WORKER tier: writes code for the given plan.'''

    _step = PipelineStep(
        name='implementer',
        model_tier=ModelTier.WORKER,
        prompt_template=_IMPLEMENTER_TEMPLATE,
        output_key='implementation',
        system_prompt=_IMPLEMENTER_SYSTEM,
    )

    async def run(self, plan: str, extra_context: str = '') -> str:
        prompt_input = plan
        if extra_context:
            prompt_input = f'{plan}\n\nReviewer feedback to address:\n{extra_context}'
        result = await Pipeline([self._step]).run(prompt_input)
        if not result.success:
            raise RuntimeError(f'ImplementerAgent failed: {result.error}')
        return result.outputs['implementation']


class ReviewerAgent:
    '''ARCHITECT tier: approves or requests changes on an implementation.'''

    _step = PipelineStep(
        name='reviewer',
        model_tier=ModelTier.ARCHITECT,
        prompt_template=_REVIEWER_TEMPLATE,
        output_key='review',
        system_prompt=_REVIEWER_SYSTEM,
    )

    async def run(self, plan: str, implementation: str) -> str:
        '''Returns the reviewer verdict string (APPROVED: ... or CHANGES_REQUESTED: ...).'''
        combined_input = f'Plan:\n{plan}\n\nImplementation:\n{implementation}'
        result = await Pipeline([self._step]).run(combined_input)
        if not result.success:
            raise RuntimeError(f'ReviewerAgent failed: {result.error}')
        return result.outputs['review']

    def is_approved(self, verdict: str) -> bool:
        return verdict.strip().upper().startswith('APPROVED')

    def extract_feedback(self, verdict: str) -> str:
        prefix = 'CHANGES_REQUESTED:'
        upper = verdict.strip().upper()
        if upper.startswith(prefix):
            return verdict.strip()[len(prefix):].strip()
        return verdict.strip()


# ---------------------------------------------------------------------------
# DevPipeline
# ---------------------------------------------------------------------------

class DevPipeline:
    '''Chains Planner → Implementer → Reviewer with up to MAX_ITERATIONS retries.

    Usage::

        result = await DevPipeline().run("Implement a retry decorator")
        if result.success:
            print(result.final_output)  # final implementation
    '''

    def __init__(self) -> None:
        self._planner = PlannerAgent()
        self._implementer = ImplementerAgent()
        self._reviewer = ReviewerAgent()

    async def run(self, task: str) -> PipelineResult:
        log.info('dev_pipeline.start', task=task[:120])

        # --- Plan ---
        try:
            plan = await self._planner.run(task)
        except Exception as exc:
            return PipelineResult(success=False, error=f'Planner: {exc}')
        log.info('dev_pipeline.planned', plan_chars=len(plan))

        # --- Implement (with review-feedback loop) ---
        feedback = ''
        implementation = ''
        verdict = ''

        for iteration in range(1, MAX_ITERATIONS + 1):
            log.info('dev_pipeline.implement', iteration=iteration)
            try:
                implementation = await self._implementer.run(plan, feedback)
            except Exception as exc:
                return PipelineResult(
                    success=False,
                    outputs={'plan': plan},
                    error=f'Implementer (iter {iteration}): {exc}',
                )

            log.info('dev_pipeline.review', iteration=iteration)
            try:
                verdict = await self._reviewer.run(plan, implementation)
            except Exception as exc:
                return PipelineResult(
                    success=False,
                    outputs={'plan': plan, 'implementation': implementation},
                    error=f'Reviewer (iter {iteration}): {exc}',
                )

            log.info(
                'dev_pipeline.verdict',
                iteration=iteration,
                approved=self._reviewer.is_approved(verdict),
                verdict=verdict[:120],
            )

            if self._reviewer.is_approved(verdict):
                break

            feedback = self._reviewer.extract_feedback(verdict)
            log.info('dev_pipeline.retry', feedback=feedback[:200])

        return PipelineResult(
            success=True,
            outputs={
                'plan': plan,
                'implementation': implementation,
                'review': verdict,
            },
            final_output=implementation,
        )
