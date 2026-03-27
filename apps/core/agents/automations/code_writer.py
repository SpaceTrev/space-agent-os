'''Space-Claw code block parser and file writer.

Handles two common LLM output conventions:

Style A — comment path inside fenced block:
    ```python
    # file: src/utils/retry.py
    def retry(...):
        ...
    ```

Style B — path in comment before fenced block:
    # file: src/utils/retry.py
    ```python
    def retry(...):
        ...
    ```

Functions:
  parse_code_blocks(llm_output)        → list[CodeBlock]
  write_code_blocks(blocks, base_dir)  → list[Path]  (written paths)
'''
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()

# Matches optional language tag + optional opening `# file:` comment
_FENCE_OPEN = re.compile(
    r'^```(?P<lang>\w+)?\s*$',
    re.MULTILINE,
)
_FENCE_CLOSE = re.compile(r'^```\s*$', re.MULTILINE)
_FILE_COMMENT = re.compile(r'^#\s*file:\s*(?P<path>\S+)', re.IGNORECASE)


@dataclass
class CodeBlock:
    path: str    # relative path as extracted from LLM output
    content: str # full file content (without the `# file:` comment line)
    lang: str    # language tag if present, else ''


def parse_code_blocks(llm_output: str) -> list[CodeBlock]:
    '''Extract all labelled code blocks from LLM output.

    A block is labelled if either:
    - Its first line inside the fence is a `# file: <path>` comment, OR
    - The line immediately before the opening fence is `# file: <path>`.

    Unlabelled blocks (no file path discoverable) are skipped.
    '''
    blocks: list[CodeBlock] = []
    lines = llm_output.splitlines(keepends=True)
    i = 0
    while i < len(lines):
        # Look for a pre-fence `# file:` comment (Style B)
        pre_path: str | None = None
        stripped = lines[i].rstrip()
        m_pre = _FILE_COMMENT.match(stripped)
        if m_pre:
            pre_path = m_pre.group('path')
            i += 1

        if i >= len(lines):
            break

        fence_match = _FENCE_OPEN.match(lines[i].rstrip())
        if not fence_match:
            if pre_path is None:
                i += 1
            # If we consumed a pre_path line but next isn't a fence, keep going
            continue

        lang = fence_match.group('lang') or ''
        i += 1  # move past opening fence

        # Collect body until closing fence
        body_lines: list[str] = []
        while i < len(lines) and not _FENCE_CLOSE.match(lines[i].rstrip()):
            body_lines.append(lines[i])
            i += 1
        i += 1  # move past closing fence

        # Check for Style A: first body line is `# file:`
        inline_path: str | None = None
        if body_lines:
            m_inline = _FILE_COMMENT.match(body_lines[0].rstrip())
            if m_inline:
                inline_path = m_inline.group('path')
                body_lines = body_lines[1:]  # strip the path comment from content

        file_path = inline_path or pre_path
        if not file_path:
            log.debug('code_writer.skip_unlabelled', lang=lang)
            continue

        content = ''.join(body_lines).rstrip('\n')
        blocks.append(CodeBlock(path=file_path, content=content, lang=lang))
        log.debug(
            'code_writer.block_parsed',
            path=file_path,
            lang=lang,
            content_chars=len(content),
        )

    log.info('code_writer.parsed', total_blocks=len(blocks))
    return blocks


def write_code_blocks(
    blocks: list[CodeBlock],
    base_dir: str | Path,
) -> list[Path]:
    '''Write code blocks to disk under base_dir.

    Intermediate directories are created automatically.
    Returns the list of written absolute paths.
    '''
    base = Path(base_dir).expanduser().resolve()
    written: list[Path] = []
    for block in blocks:
        # Sanitise: strip leading slash / drive letter to stay within base_dir
        rel = Path(block.path)
        if rel.is_absolute():
            rel = Path(*rel.parts[1:])
        target = base / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(block.content, encoding='utf-8')
        written.append(target)
        log.info('code_writer.wrote', path=str(target), chars=len(block.content))
    return written
