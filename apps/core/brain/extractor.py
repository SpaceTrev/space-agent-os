"""
extractor.py — Post-task skill and knowledge extraction.

After every completed task, the extractor:
1. Sends the task + output to the LLM with an extraction prompt
2. Parses the structured response into a SkillDoc or BrainUpdate
3. Writes the doc to brain/skills/ (or updates an existing brain doc)
4. Calls loader.reload() so the new knowledge is available immediately

Environment:
    BRAIN_EXTRACT_ENABLED — set to "false" to disable auto-extraction
    BRAIN_ROOT            — path to brain/ vault
"""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger()

EXTRACT_ENABLED: bool = os.getenv("BRAIN_EXTRACT_ENABLED", "true").lower() == "true"

# ─── Prompts ──────────────────────────────────────────────────────────────────

_EXTRACTION_SYSTEM = """\
You are Space Scribe, the knowledge extraction engine for Space-Agent-OS.

Your job: read a completed task + its output and extract ONE reusable skill or
insight that future agents should know. Be ruthlessly selective — only extract
something if it is:
  (a) non-obvious and not in existing documentation
  (b) reproducible (another agent could apply it on a similar task)
  (c) concise enough to fit in ~500 tokens

If there is nothing worth extracting, output exactly: NO_EXTRACT

Otherwise, output a JSON object with this schema:
{
  "id": "skills-<domain>-<kebab-slug>",     // unique, e.g. "skills-python-httpx-retry"
  "title": "Human-Readable Skill Title",
  "vault": "skills",
  "domain": "<domain>",                      // python, discord, git, react, ops, etc.
  "tags": ["tag1", "tag2"],
  "priority": "normal",
  "pattern": "When: <trigger situation>",
  "steps": ["Step 1", "Step 2"],
  "example": "// minimal code or command snippet",
  "antipatterns": ["Don't do X because Y"]
}

Output ONLY valid JSON or "NO_EXTRACT". No markdown, no explanation.
"""

_EXTRACTION_USER_TPL = """\
TASK: {task}

OUTPUT:
{output}
"""

# ─── Data models ─────────────────────────────────────────────────────────────


@dataclass
class SkillDoc:
    """A validated skill ready to write to brain/skills/."""

    id: str
    title: str
    domain: str
    tags: list[str]
    pattern: str
    steps: list[str]
    example: str
    antipatterns: list[str] = field(default_factory=list)

    def to_markdown(self) -> str:
        today = time.strftime("%Y-%m-%d", time.gmtime())
        steps_md = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(self.steps))
        antipatterns_md = "\n".join(f"- {a}" for a in self.antipatterns)
        tags_yaml = "\n".join(f"  - {t}" for t in self.tags)
        return f"""\
---
id: {self.id}
title: {self.title}
vault: skills
domain: {self.domain}
tags:
{tags_yaml}
priority: normal
created: {today}
updated: {today}
---

## Pattern

{self.pattern}

## Steps

{steps_md}

## Example

```
{self.example}
```

## Antipatterns

{antipatterns_md or "- None identified"}
"""


@dataclass
class ExtractionResult:
    """Result of an extraction attempt."""

    extracted: bool
    skill: SkillDoc | None = None
    skill_path: Path | None = None
    reason: str = ""


# ─── Core extraction logic ────────────────────────────────────────────────────


async def extract_from_task(
    task: str,
    output: str,
    brain_root: Path | None = None,
) -> ExtractionResult:
    """
    Run post-task extraction.

    Calls the LLM to extract a skill from the task+output pair, validates the
    response, writes it to brain/skills/, and triggers a loader reload.

    Args:
        task:       the task description that was completed
        output:     the agent's output / result
        brain_root: path to brain/ vault (default: BRAIN_ROOT env var)

    Returns:
        ExtractionResult describing what (if anything) was extracted.
    """
    if not EXTRACT_ENABLED:
        log.debug("brain.extractor.disabled")
        return ExtractionResult(extracted=False, reason="extraction disabled")

    from brain.loader import BRAIN_ROOT
    root = brain_root or BRAIN_ROOT

    prompt = _EXTRACTION_USER_TPL.format(
        task=task.strip(),
        output=output.strip()[:4000],  # cap to avoid token explosion
    )

    log.info("brain.extractor.running", task_preview=task[:80])

    try:
        raw = await _call_extractor_llm(prompt)
    except Exception as exc:
        log.error("brain.extractor.llm_error", error=str(exc))
        return ExtractionResult(extracted=False, reason=f"llm error: {exc}")

    if raw.strip() == "NO_EXTRACT":
        log.info("brain.extractor.no_extract", task_preview=task[:80])
        return ExtractionResult(extracted=False, reason="no reusable skill found")

    skill, err = _parse_skill(raw)
    if skill is None:
        log.warning("brain.extractor.parse_error", error=err, raw_preview=raw[:200])
        return ExtractionResult(extracted=False, reason=f"parse error: {err}")

    skill_path = _write_skill(skill, root)
    log.info(
        "brain.extractor.skill_written",
        skill_id=skill.id,
        path=str(skill_path),
    )

    # Trigger loader reload so the skill is available immediately
    try:
        from brain.loader import BrainLoader
        BrainLoader(root).reload()
    except Exception:
        pass  # reload failure is non-fatal

    return ExtractionResult(extracted=True, skill=skill, skill_path=skill_path)


def _parse_skill(raw: str) -> tuple[SkillDoc | None, str]:
    """Parse LLM JSON output into a SkillDoc. Returns (skill, error_msg)."""
    # Strip any accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError as exc:
        return None, f"JSON parse failed: {exc}"

    required = ("id", "title", "domain", "tags", "pattern", "steps", "example")
    for key in required:
        if key not in data:
            return None, f"missing field: {key}"

    skill = SkillDoc(
        id=str(data["id"]),
        title=str(data["title"]),
        domain=str(data["domain"]),
        tags=[str(t) for t in data.get("tags", [])],
        pattern=str(data["pattern"]),
        steps=[str(s) for s in data.get("steps", [])],
        example=str(data["example"]),
        antipatterns=[str(a) for a in data.get("antipatterns", [])],
    )

    # Validate id format
    if not re.match(r"^skills-[a-z0-9-]+$", skill.id):
        skill.id = "skills-" + re.sub(r"[^a-z0-9-]", "-", skill.id.lower())

    return skill, ""


def _write_skill(skill: SkillDoc, brain_root: Path) -> Path:
    """Write the skill doc to brain/skills/. Overwrites if same id exists."""
    skills_dir = brain_root / "skills"
    skills_dir.mkdir(parents=True, exist_ok=True)

    slug = skill.id.removeprefix("skills-")
    path = skills_dir / f"{slug}.md"
    path.write_text(skill.to_markdown(), encoding="utf-8")
    return path


async def _call_extractor_llm(prompt: str) -> str:
    """
    Call the configured LLM backend for extraction.
    Uses the same routing as call_llm but with extraction-specific system prompt.
    """
    import os

    backend = os.getenv("PRIMARY_BACKEND", "ollama").lower()
    import httpx

    if backend == "claude_max":
        proxy_url = os.getenv("CLAUDE_MAX_PROXY_URL", "http://localhost:3456/v1")
        model = "claude-sonnet-4"
        messages = [
            {"role": "user", "content": prompt},
        ]
        payload = {"model": model, "messages": messages, "max_tokens": 1024}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{proxy_url}/chat/completions",
                json=payload,
                headers={"X-System-Prompt": _EXTRACTION_SYSTEM},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

    if backend == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        try:
            import anthropic
        except ImportError as exc:
            raise ImportError("uv add anthropic") from exc
        client = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model=os.getenv("PRIMARY_MODEL", "claude-sonnet-4-6"),
            max_tokens=1024,
            system=_EXTRACTION_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text  # type: ignore[union-attr]

    # Ollama fallback
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("WORKER_MODEL", "qwen3-coder:30b")
    async with httpx.AsyncClient(base_url=ollama_url, timeout=120.0) as client:
        resp = await client.post(
            "/api/generate",
            json={
                "model": model,
                "prompt": f"{_EXTRACTION_SYSTEM}\n\n{prompt}",
                "stream": False,
            },
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
