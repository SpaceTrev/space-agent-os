"""
youtube_ingest — YouTube transcript ingestion into Space Scribe brain vault.

Pulls a YouTube video's transcript, generates an LLM summary + key takeaways,
and writes a brain doc to brain/<vault>/<slug>.md.

Transcript fetching order (graceful fallback):
  1. yt-dlp VTT captions (handles auto-generated + manual, most reliable)
  2. youtube-transcript-api Python package
  3. Saves a stub note without transcript body if both fail

Usage (CLI):
  # from repo root
  uv run python -m skills.youtube_ingest <url> [--vault skills] [--title "override"] [--tags tag1,tag2]

Usage (Python):
  from skills.youtube_ingest import run_ingest
  result = asyncio.run(run_ingest("https://www.youtube.com/watch?v=vIX6ztULs4U"))

Environment:
  BRAIN_ROOT          — path to brain/ vault (default: <repo_root>/brain)
  PRIMARY_BACKEND     — llm backend: anthropic | claude_max | ollama (default: anthropic)
  ANTHROPIC_API_KEY   — required for anthropic backend
  CLAUDE_MAX_PROXY_URL— required for claude_max backend
  OLLAMA_BASE_URL     — required for ollama backend
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger()

# ─── Config ───────────────────────────────────────────────────────────────────

_REPO_ROOT = Path(__file__).parent.parent.parent.parent  # worktree root
_DEFAULT_BRAIN_ROOT = _REPO_ROOT / "brain"
BRAIN_ROOT: Path = Path(os.getenv("BRAIN_ROOT", str(_DEFAULT_BRAIN_ROOT)))

VALID_VAULTS = {"company", "engineering", "marketing", "sales", "operations", "skills"}

# ─── Data models ─────────────────────────────────────────────────────────────


@dataclass
class VideoMeta:
    """Metadata extracted from a YouTube video."""

    video_id: str
    url: str
    title: str
    channel: str
    duration_seconds: int
    description: str = ""

    @property
    def duration_str(self) -> str:
        """Format duration as HH:MM:SS or MM:SS."""
        s = self.duration_seconds
        h, m, sec = s // 3600, (s % 3600) // 60, s % 60
        if h:
            return f"{h}:{m:02d}:{sec:02d}"
        return f"{m}:{sec:02d}"


@dataclass
class IngestResult:
    """Result of a youtube_ingest run."""

    success: bool
    vault_path: Path | None = None
    video: VideoMeta | None = None
    tldr: str = ""
    key_takeaways: list[str] = field(default_factory=list)
    transcript_chars: int = 0
    error: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "vault_path": str(self.vault_path) if self.vault_path else None,
            "video_id": self.video.video_id if self.video else None,
            "title": self.video.title if self.video else None,
            "channel": self.video.channel if self.video else None,
            "tldr": self.tldr,
            "key_takeaways": self.key_takeaways,
            "transcript_chars": self.transcript_chars,
            "error": self.error,
        }


# ─── Video ID extraction ──────────────────────────────────────────────────────


def extract_video_id(url_or_id: str) -> str:
    """Extract video ID from a YouTube URL or return the ID as-is."""
    # Already just an ID (11 chars, alphanumeric + _ -)
    if re.match(r"^[A-Za-z0-9_-]{11}$", url_or_id):
        return url_or_id

    # youtu.be short links
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]{11})", url_or_id)
    if m:
        return m.group(1)

    # youtube.com/watch?v=
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{11})", url_or_id)
    if m:
        return m.group(1)

    # youtube.com/embed/ or /shorts/
    m = re.search(r"(?:embed|shorts)/([A-Za-z0-9_-]{11})", url_or_id)
    if m:
        return m.group(1)

    raise ValueError(f"Cannot extract video ID from: {url_or_id!r}")


# ─── Metadata fetching ────────────────────────────────────────────────────────


def fetch_video_meta(video_id: str) -> VideoMeta:
    """
    Fetch video metadata using yt-dlp --dump-json.
    Falls back to a minimal stub if yt-dlp is unavailable.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-playlist", url],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr[:500])
        data = json.loads(result.stdout)
        return VideoMeta(
            video_id=video_id,
            url=url,
            title=data.get("title", "Unknown Title"),
            channel=data.get("uploader") or data.get("channel") or "Unknown Channel",
            duration_seconds=int(data.get("duration") or 0),
            description=(data.get("description") or "")[:500],
        )
    except Exception as exc:
        log.warning("youtube_ingest.meta.failed", error=str(exc), video_id=video_id)
        return VideoMeta(
            video_id=video_id,
            url=url,
            title="Unknown Title",
            channel="Unknown Channel",
            duration_seconds=0,
        )


# ─── Transcript fetching ──────────────────────────────────────────────────────


def _parse_vtt(vtt_text: str) -> str:
    """
    Parse WebVTT subtitle text into clean plain text.
    Removes timestamps, tags, and deduplicates consecutive repeated lines.
    """
    lines: list[str] = []
    seen_last: str = ""

    for line in vtt_text.splitlines():
        line = line.strip()

        # Skip WebVTT header, timestamp lines, NOTE blocks, blank lines
        if (
            not line
            or line.startswith("WEBVTT")
            or line.startswith("NOTE")
            or re.match(r"\d{2}:\d{2}", line)  # timestamp
            or re.match(r"^\d+$", line)  # cue index
            or line.startswith("Kind:")
            or line.startswith("Language:")
        ):
            continue

        # Strip inline tags: <c>, </c>, <00:00:00.000>, <i>, etc.
        line = re.sub(r"<[^>]+>", "", line).strip()
        if not line:
            continue

        # Deduplicate consecutive identical lines (common in auto-captions)
        if line == seen_last:
            continue
        seen_last = line
        lines.append(line)

    return " ".join(lines)


def _fetch_transcript_ytdlp(video_id: str) -> str | None:
    """
    Method 1: Use yt-dlp to download VTT subtitles, parse to plain text.
    Tries manual captions first, then auto-generated.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    with tempfile.TemporaryDirectory() as tmpdir:
        out_template = os.path.join(tmpdir, "%(id)s")
        cmd = [
            "yt-dlp",
            "--write-subs",
            "--write-auto-subs",
            "--skip-download",
            "--sub-format", "vtt",
            "--sub-langs", "en,en-US,en-GB,en-auto",
            "--no-playlist",
            "-o", out_template,
            url,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                log.debug(
                    "youtube_ingest.ytdlp.failed",
                    stderr=result.stderr[:300],
                    video_id=video_id,
                )
        except subprocess.TimeoutExpired:
            log.warning("youtube_ingest.ytdlp.timeout", video_id=video_id)
            return None
        except FileNotFoundError:
            log.warning("youtube_ingest.ytdlp.not_found")
            return None

        # Find any .vtt file written to tmpdir
        vtt_files = sorted(Path(tmpdir).glob("*.vtt"))
        if not vtt_files:
            log.debug("youtube_ingest.ytdlp.no_vtt", video_id=video_id)
            return None

        # Prefer manual captions (no "auto" in filename) over auto-generated
        manual = [f for f in vtt_files if "auto" not in f.name.lower()]
        chosen = manual[0] if manual else vtt_files[0]
        log.info("youtube_ingest.ytdlp.vtt", file=chosen.name, video_id=video_id)

        vtt_text = chosen.read_text(encoding="utf-8", errors="replace")
        return _parse_vtt(vtt_text) or None


def _fetch_transcript_api(video_id: str) -> str | None:
    """
    Method 2: youtube-transcript-api Python package.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore[import]
        from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled  # type: ignore[import]
    except ImportError:
        log.debug("youtube_ingest.transcript_api.not_installed")
        return None

    try:
        # Try English first, then any available language
        try:
            entries = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US"])
        except NoTranscriptFound:
            entries = YouTubeTranscriptApi.get_transcript(video_id)

        text = " ".join(e["text"] for e in entries)
        log.info("youtube_ingest.transcript_api.ok", chars=len(text), video_id=video_id)
        return text or None
    except (TranscriptsDisabled, Exception) as exc:
        log.debug("youtube_ingest.transcript_api.failed", error=str(exc), video_id=video_id)
        return None


def fetch_transcript(video_id: str) -> tuple[str | None, str]:
    """
    Fetch transcript with graceful fallback chain.
    Returns (transcript_text, method_used).
    """
    log.info("youtube_ingest.transcript.fetch", video_id=video_id)

    text = _fetch_transcript_ytdlp(video_id)
    if text and len(text.strip()) > 100:
        return text, "yt-dlp"

    text = _fetch_transcript_api(video_id)
    if text and len(text.strip()) > 100:
        return text, "youtube-transcript-api"

    log.warning("youtube_ingest.transcript.unavailable", video_id=video_id)
    return None, "none"


# ─── LLM summarisation ────────────────────────────────────────────────────────

_SUMMARY_SYSTEM = """\
You are Space Scribe, the knowledge extraction engine for Space-Agent-OS.

Given a YouTube video transcript, produce a structured summary in JSON.
Be concise but technically precise — this will be filed in an engineering brain vault.

Output ONLY valid JSON (no markdown, no explanation):
{
  "tldr": "2-4 sentence summary of what this video teaches",
  "key_takeaways": ["takeaway 1", "takeaway 2", ...],  // 5-10 bullets
  "tags": ["tag1", "tag2", ...],  // 3-8 relevant lowercase tags
  "domain": "primary-domain-slug"  // e.g. playwright, python, tradingview, react
}
"""

_SUMMARY_USER_TPL = """\
VIDEO: {title}
CHANNEL: {channel}
DURATION: {duration}

TRANSCRIPT (first 12000 chars):
{transcript}
"""


async def _call_summary_llm(prompt: str) -> str:
    """Call the configured LLM backend for summarisation."""
    import httpx

    backend = os.getenv("PRIMARY_BACKEND", "anthropic").lower()

    # OpenClaw / OpenAI-compatible proxy (claude_max)
    if backend == "claude_max":
        proxy_url = os.getenv("CLAUDE_MAX_PROXY_URL", "http://localhost:3456/v1")
        model = os.getenv("PRIMARY_MODEL", "claude-sonnet-4-6")
        # Use system role message — avoids ASCII-encoding issues with X-System-Prompt header
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": _SUMMARY_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{proxy_url}/chat/completions",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

    # Anthropic SDK (direct API) — also reached when claude_max proxy is unavailable
    if backend in ("anthropic", "claude_max"):
        try:
            import anthropic  # type: ignore[import]
        except ImportError as exc:
            raise ImportError("uv add anthropic") from exc

        # Prefer ANTHROPIC_API_KEY; fall back to CLAUDE_CODE_OAUTH_TOKEN (Claude Code env)
        api_key = (
            os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("CLAUDE_CODE_OAUTH_TOKEN")
            or ""
        )
        if not api_key:
            raise RuntimeError("No API key: set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN")

        client = anthropic.AsyncAnthropic(api_key=api_key)

        # Retry once on rate-limit (common when running inside an active Claude Code session)
        for attempt in range(2):
            try:
                response = await client.messages.create(
                    model=os.getenv("PRIMARY_MODEL", "claude-sonnet-4-6"),
                    max_tokens=1024,
                    system=_SUMMARY_SYSTEM,
                    messages=[{"role": "user", "content": prompt}],
                )
                return response.content[0].text  # type: ignore[union-attr]
            except anthropic.RateLimitError:
                if attempt == 0:
                    log.warning("youtube_ingest.summarise.rate_limit", retry_in=10)
                    await asyncio.sleep(10)
                else:
                    raise

    # Ollama fallback
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("WORKER_MODEL", "qwen3-coder:30b")
    async with httpx.AsyncClient(base_url=ollama_url, timeout=120.0) as client:
        resp = await client.post(
            "/api/generate",
            json={
                "model": model,
                "prompt": f"{_SUMMARY_SYSTEM}\n\n{prompt}",
                "stream": False,
            },
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


async def summarise_transcript(
    transcript: str,
    meta: VideoMeta,
) -> tuple[str, list[str], list[str], str]:
    """
    Ask LLM to summarise transcript.
    Returns (tldr, key_takeaways, tags, domain).
    """
    # Cap transcript to avoid token explosion
    snippet = transcript[:12000]
    prompt = _SUMMARY_USER_TPL.format(
        title=meta.title,
        channel=meta.channel,
        duration=meta.duration_str,
        transcript=snippet,
    )
    try:
        raw = await _call_summary_llm(prompt)
    except Exception as exc:
        log.error("youtube_ingest.summarise.failed", error=str(exc))
        return (
            f"Transcript ingested from {meta.channel} — summary unavailable ({exc}).",
            [],
            ["youtube", "video"],
            "video",
        )

    # Strip accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
        tldr = str(data.get("tldr", ""))
        takeaways = [str(t) for t in data.get("key_takeaways", [])]
        tags = [str(t) for t in data.get("tags", [])]
        domain = str(data.get("domain", "video"))
        return tldr, takeaways, tags, domain
    except (json.JSONDecodeError, KeyError) as exc:
        log.warning("youtube_ingest.summarise.parse_error", error=str(exc), raw=raw[:200])
        return (
            f"Transcript ingested — LLM summary parse failed.",
            [],
            ["youtube"],
            "video",
        )


# ─── Brain doc generation ─────────────────────────────────────────────────────


def _slugify(text: str, max_len: int = 50) -> str:
    """Convert a string to a kebab-case slug."""
    slug = text.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug[:max_len].rstrip("-")


def build_brain_doc(
    meta: VideoMeta,
    vault: str,
    tldr: str,
    key_takeaways: list[str],
    tags: list[str],
    domain: str,
    transcript: str | None,
    title_override: str | None = None,
) -> str:
    """Render the brain doc markdown string."""
    today = time.strftime("%Y-%m-%d", time.gmtime())
    display_title = title_override or meta.title
    doc_id = f"{vault}-youtube-{_slugify(meta.video_id)}"

    # Ensure "youtube" tag is always present
    all_tags = sorted({"youtube", "video", *tags})
    tags_yaml = "\n".join(f"  - {t}" for t in all_tags)

    # Key takeaways section
    if key_takeaways:
        takeaways_md = "\n".join(f"- {t}" for t in key_takeaways)
    else:
        takeaways_md = "_No takeaways extracted._"

    # Transcript section
    if transcript:
        transcript_md = f"## Full Transcript\n\n{transcript}"
    else:
        transcript_md = "_Transcript unavailable — captions disabled or private video._"

    token_estimate = max(100, (len(tldr) + len(takeaways_md) + len(transcript or "")) // 4)

    return f"""\
---
id: {doc_id}
title: "{display_title}"
vault: {vault}
domain: {domain}
source: youtube
video_id: {meta.video_id}
url: {meta.url}
channel: "{meta.channel}"
duration: "{meta.duration_str}"
ingested_at: {today}
tags:
{tags_yaml}
priority: normal
created: {today}
updated: {today}
token_estimate: {token_estimate}
---

## TL;DR

{tldr or "_Summary not available._"}

## Key Takeaways

{takeaways_md}

{transcript_md}
"""


def write_brain_doc(
    content: str,
    vault: str,
    slug: str,
    brain_root: Path = BRAIN_ROOT,
) -> Path:
    """Write brain doc to brain/<vault>/<slug>.md."""
    vault_dir = brain_root / vault
    vault_dir.mkdir(parents=True, exist_ok=True)
    path = vault_dir / f"{slug}.md"
    path.write_text(content, encoding="utf-8")
    log.info("youtube_ingest.doc.written", path=str(path))
    return path


# ─── Main entry point ─────────────────────────────────────────────────────────


async def run_ingest(
    url_or_id: str,
    vault: str = "skills",
    title_override: str | None = None,
    extra_tags: list[str] | None = None,
    brain_root: Path | None = None,
) -> IngestResult:
    """
    Full ingestion pipeline: fetch metadata → transcript → summarise → write.

    Args:
        url_or_id:     YouTube URL or 11-char video ID
        vault:         Target brain vault (default: "skills")
        title_override: Override the video title in the doc
        extra_tags:    Additional tags to add to the doc
        brain_root:    Override brain/ path (uses BRAIN_ROOT env by default)

    Returns:
        IngestResult with vault_path, tldr, key_takeaways, and error info.
    """
    root = brain_root or BRAIN_ROOT
    if vault not in VALID_VAULTS:
        return IngestResult(
            success=False,
            error=f"Invalid vault: {vault!r}. Choose from: {', '.join(sorted(VALID_VAULTS))}",
        )

    # 1. Extract video ID
    try:
        video_id = extract_video_id(url_or_id)
    except ValueError as exc:
        return IngestResult(success=False, error=str(exc))

    log.info("youtube_ingest.start", video_id=video_id, vault=vault)

    # 2. Fetch metadata
    meta = fetch_video_meta(video_id)

    # 3. Fetch transcript
    transcript, method = fetch_transcript(video_id)
    log.info(
        "youtube_ingest.transcript.done",
        method=method,
        chars=len(transcript) if transcript else 0,
    )

    # 4. Summarise
    if transcript:
        tldr, takeaways, llm_tags, domain = await summarise_transcript(transcript, meta)
    else:
        tldr = f"Transcript unavailable for \"{meta.title}\" — captions may be disabled."
        takeaways = []
        llm_tags = []
        domain = "video"

    # Merge tags
    merged_tags = list({*llm_tags, *(extra_tags or [])})

    # 5. Build + write doc
    slug = f"youtube-{_slugify(meta.video_id)}"
    doc_content = build_brain_doc(
        meta=meta,
        vault=vault,
        tldr=tldr,
        key_takeaways=takeaways,
        tags=merged_tags,
        domain=domain,
        transcript=transcript,
        title_override=title_override,
    )
    vault_path = write_brain_doc(doc_content, vault=vault, slug=slug, brain_root=root)

    # 6. Trigger brain loader reload (non-fatal)
    try:
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from brain.loader import BrainLoader  # type: ignore[import]
        BrainLoader(root).reload()
    except Exception as exc:
        log.debug("youtube_ingest.loader_reload.skip", reason=str(exc))

    return IngestResult(
        success=True,
        vault_path=vault_path,
        video=meta,
        tldr=tldr,
        key_takeaways=takeaways,
        transcript_chars=len(transcript) if transcript else 0,
    )


# ─── CLI ──────────────────────────────────────────────────────────────────────


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="youtube_ingest",
        description="Ingest a YouTube transcript into the Space Scribe brain vault.",
    )
    p.add_argument("url", help="YouTube URL or video ID")
    p.add_argument(
        "--vault",
        default="skills",
        choices=sorted(VALID_VAULTS),
        help="Target brain vault (default: skills)",
    )
    p.add_argument("--title", dest="title_override", help="Override video title in doc")
    p.add_argument(
        "--tags",
        default="",
        help="Comma-separated extra tags to add to the doc",
    )
    p.add_argument("--json", action="store_true", help="Output result as JSON")
    return p


def main(argv: list[str] | None = None) -> None:  # noqa: ANN001
    """CLI entry point."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    extra_tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    result = asyncio.run(
        run_ingest(
            url_or_id=args.url,
            vault=args.vault,
            title_override=args.title_override,
            extra_tags=extra_tags,
        )
    )

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        sys.exit(0 if result.success else 1)

    if not result.success:
        print(f"ERROR: {result.error}", file=sys.stderr)
        sys.exit(1)

    print(f"\n✓ Ingested: {result.video.title if result.video else 'Unknown'}")
    print(f"  Channel:  {result.video.channel if result.video else 'Unknown'}")
    print(f"  Duration: {result.video.duration_str if result.video else '?'}")
    print(f"  Vault:    {result.vault_path}")
    print(f"  Chars:    {result.transcript_chars:,}")
    print(f"\nTL;DR:\n{result.tldr}")
    if result.key_takeaways:
        print("\nKey Takeaways:")
        for t in result.key_takeaways:
            print(f"  • {t}")


if __name__ == "__main__":
    main()
