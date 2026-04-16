---
id: skills-youtube-ingest-pattern
title: YouTube Transcript Ingestion into Brain Vault
vault: skills
domain: ingestion
tags:
  - youtube
  - ingestion
  - yt-dlp
  - transcript
  - brain-vault
  - space-scribe
priority: normal
created: 2026-04-14
updated: 2026-04-14
token_estimate: 400
---

## Pattern

When: an agent or user has a YouTube URL and wants to file the transcript + summary as a brain doc for future context retrieval.

## Steps

1. Extract video ID from any YouTube URL format (youtu.be, watch?v=, embed/, shorts/).
2. Fetch metadata via `yt-dlp --dump-json --no-playlist <url>` (title, channel, duration).
3. Fetch transcript — try in order: `yt-dlp --write-auto-subs --sub-format vtt`, then `youtube-transcript-api`.
4. Parse VTT → plain text (strip timestamps, deduplicate consecutive lines).
5. Call LLM with transcript snippet ≤12,000 chars to generate JSON: `{tldr, key_takeaways, tags, domain}`.
6. Render brain doc with YAML frontmatter (`source: youtube`, `video_id`, `url`, `channel`, `duration`, `ingested_at`) + TL;DR + takeaways + full transcript.
7. Write to `brain/<vault>/<slug>.md`; trigger `BrainLoader.reload()`.

## Example

```bash
# CLI
uv run python -m skills.youtube_ingest "https://www.youtube.com/watch?v=<id>" --vault skills

# API
curl -X POST http://localhost:8000/ingest/youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=<id>", "vault": "engineering"}'

# Python
from skills.youtube_ingest import run_ingest
result = asyncio.run(run_ingest("https://...", vault="skills"))
print(result.vault_path, result.tldr)
```

## Antipatterns

- Don't fetch full-length transcript for LLM summarisation — cap at 12,000 chars to avoid token explosion; full transcript still goes in the brain doc body.
- Don't pass system prompts as HTTP headers to the OpenClaw proxy — headers must be ASCII; use `{"role": "system"}` message instead.
- Don't assume `ANTHROPIC_API_KEY` is set inside an active Claude Code session — fall back to `CLAUDE_CODE_OAUTH_TOKEN`.
- Don't hard-code the vault; default to `skills` but accept it as a parameter.
