#!/usr/bin/env python3
"""
verify_ignition.py — Space-Claw system health check.

Verifies all external dependencies are reachable before first launch:
  - Ollama (local) + required models
  - Anthropic API
  - OpenAI API       (skipped if key not set)
  - Gemini API       (skipped if key not set)
  - Database         (SQLite or Supabase)

Run:  uv run python verify_ignition.py
"""

import asyncio
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load .env from the same directory as this script
load_dotenv(Path(__file__).parent / ".env")

# ── ANSI colours ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

PASS  = f"{GREEN}✓ PASS{RESET}"
FAIL  = f"{RED}✗ FAIL{RESET}"
SKIP  = f"{YELLOW}⚠ SKIP{RESET}"

REQUIRED_MODELS = ["qwen3-coder", "llama3"]  # substring match — covers variant tags


def _header(title: str) -> None:
    print(f"\n{BOLD}{'─' * 52}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'─' * 52}{RESET}")


def _result(label: str, status: str, detail: str = "") -> None:
    detail_str = f"  {detail}" if detail else ""
    print(f"  {status}  {label}{detail_str}")


# ── Ollama ────────────────────────────────────────────────────────────────────

async def check_ollama(client: httpx.AsyncClient) -> bool:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    _header("Ollama (local inference)")

    # 1. Reachability
    try:
        resp = await client.get(f"{base_url}/api/tags", timeout=5)
        resp.raise_for_status()
        models_data = resp.json()
    except Exception as exc:
        _result("Ollama reachable", FAIL, str(exc))
        return False

    _result("Ollama reachable", PASS, base_url)

    # 2. Model presence
    loaded = [m["name"] for m in models_data.get("models", [])]
    all_ok = True
    for required in REQUIRED_MODELS:
        found = [m for m in loaded if required in m]
        if found:
            _result(f"Model: {required}", PASS, found[0])
        else:
            _result(f"Model: {required}", FAIL, f"not found — run: ollama pull {required}")
            all_ok = False

    if not loaded:
        _result("Available models", SKIP, "no models loaded in Ollama yet")

    return all_ok


# ── Anthropic ─────────────────────────────────────────────────────────────────

async def check_anthropic(client: httpx.AsyncClient) -> bool:
    _header("Anthropic API (Architect tier)")
    api_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not api_key or api_key.startswith("sk-ant-..."):
        _result("ANTHROPIC_API_KEY", SKIP, "not set — Architect tier unavailable")
        return False

    try:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": "ping"}],
            },
            timeout=15,
        )
        if resp.status_code in (200, 400):  # 400 = bad request but key is valid
            _result("Anthropic API", PASS, f"HTTP {resp.status_code}")
            return True
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if code == 401:
            _result("Anthropic API", FAIL, "invalid API key")
        else:
            _result("Anthropic API", FAIL, f"HTTP {code}")
        return False
    except Exception as exc:
        _result("Anthropic API", FAIL, str(exc))
        return False

    return True


# ── OpenAI ────────────────────────────────────────────────────────────────────

async def check_openai(client: httpx.AsyncClient) -> bool:
    _header("OpenAI API (optional)")
    api_key = os.getenv("OPENAI_API_KEY", "")

    if not api_key:
        _result("OPENAI_API_KEY", SKIP, "not set — skipping")
        return True  # not required

    try:
        resp = await client.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if resp.status_code == 200:
            _result("OpenAI API", PASS)
            return True
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        _result("OpenAI API", FAIL, f"HTTP {code} — check OPENAI_API_KEY")
        return False
    except Exception as exc:
        _result("OpenAI API", FAIL, str(exc))
        return False

    return True


# ── Gemini ────────────────────────────────────────────────────────────────────

async def check_gemini(client: httpx.AsyncClient) -> bool:
    _header("Gemini API (optional)")
    api_key = os.getenv("GEMINI_API_KEY", "")

    if not api_key:
        _result("GEMINI_API_KEY", SKIP, "not set — skipping")
        return True  # not required

    try:
        resp = await client.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
            timeout=10,
        )
        if resp.status_code == 200:
            _result("Gemini API", PASS)
            return True
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        _result("Gemini API", FAIL, f"HTTP {code} — check GEMINI_API_KEY")
        return False
    except Exception as exc:
        _result("Gemini API", FAIL, str(exc))
        return False

    return True


# ── Database ──────────────────────────────────────────────────────────────────

async def check_database(client: httpx.AsyncClient) -> bool:
    _header("Database")

    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")

    if supabase_url and supabase_key:
        try:
            resp = await client.get(
                f"{supabase_url}/rest/v1/",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
                timeout=10,
            )
            if resp.status_code in (200, 404):  # 404 = reachable but no table yet
                _result("Supabase", PASS, supabase_url)
                return True
            resp.raise_for_status()
        except Exception as exc:
            _result("Supabase", FAIL, str(exc))
            return False

    # Fall back to SQLite check
    sqlite_candidates = [
        Path(__file__).parent / "space_claw.db",
        Path(__file__).parent / "data" / "space_claw.db",
    ]
    for db_path in sqlite_candidates:
        if db_path.exists():
            _result("SQLite", PASS, str(db_path))
            return True

    _result("Database", SKIP, "neither SUPABASE_URL nor a local SQLite db found")
    return True  # not hard-required at ignition time


# ── Entrypoint ────────────────────────────────────────────────────────────────

async def main() -> int:
    print(f"\n{BOLD}🚀 Space-Claw — Ignition Verification{RESET}")

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            check_ollama(client),
            check_anthropic(client),
            check_openai(client),
            check_gemini(client),
            check_database(client),
        )

    ollama_ok, anthropic_ok, openai_ok, gemini_ok, db_ok = results

    _header("Summary")
    _result("Ollama + models",  PASS if ollama_ok    else FAIL)
    _result("Anthropic API",    PASS if anthropic_ok else SKIP)
    _result("OpenAI API",       PASS if openai_ok    else SKIP)
    _result("Gemini API",       PASS if gemini_ok    else SKIP)
    _result("Database",         PASS if db_ok        else FAIL)

    hard_fail = not ollama_ok  # Ollama is required; cloud APIs are optional
    if hard_fail:
        print(f"\n{RED}{BOLD}  Ignition FAILED — fix the above before starting Space-Claw.{RESET}\n")
        return 1

    print(f"\n{GREEN}{BOLD}  Ignition OK — ready to launch.{RESET}\n")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
