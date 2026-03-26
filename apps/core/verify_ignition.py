"""
Space-Claw — Ignition Verification

Checks that all required services are reachable before launch:
  ✓ Ollama (orchestrator + worker models)
  ✓ Gemini API (cloud tier)
  ✓ Discord bot token (validates via Discord API)

Usage:
    uv run python verify_ignition.py
"""

import asyncio
import os
import sys

import httpx
import structlog
from dotenv import load_dotenv

load_dotenv()

structlog.configure(wrapper_class=structlog.make_filtering_bound_logger(20))  # INFO
log = structlog.get_logger()

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ORCHESTRATOR_MODEL: str = os.getenv("ORCHESTRATOR_MODEL", "llama3.3:8b")
WORKER_MODEL: str = os.getenv("WORKER_MODEL", "qwen3-coder:30b-a3b")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
DISCORD_BOT_TOKEN: str = os.getenv("DISCORD_BOT_TOKEN", "")


# ── Checks ────────────────────────────────────────────────────────────────────


async def check_ollama(client: httpx.AsyncClient) -> bool:
    """Ping Ollama and verify configured models are present."""
    try:
        r = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        r.raise_for_status()
        available = {m["name"] for m in r.json().get("models", [])}

        ok = True
        for model in (ORCHESTRATOR_MODEL, WORKER_MODEL):
            # Match on prefix (e.g. "llama3.3:8b" matches "llama3.3:8b-instruct-q4_K_M")
            found = any(m.startswith(model.split(":")[0]) for m in available)
            if found:
                log.info("ollama.model.ok", model=model)
            else:
                log.warning("ollama.model.missing", model=model, available=sorted(available))
                ok = False
        return ok
    except Exception as exc:
        log.error("ollama.unreachable", error=str(exc), url=OLLAMA_BASE_URL)
        return False


async def check_gemini(client: httpx.AsyncClient) -> bool:
    """Verify GEMINI_API_KEY by listing available models."""
    if not GEMINI_API_KEY:
        log.error("gemini.key.missing", hint="Set GEMINI_API_KEY in .env")
        return False
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"
        r = await client.get(url, timeout=10.0)
        if r.status_code == 200:
            models = r.json().get("models", [])
            log.info("gemini.ok", model_count=len(models))
            return True
        elif r.status_code == 400:
            log.error("gemini.key.invalid", status=r.status_code, body=r.text[:200])
            return False
        else:
            log.error("gemini.error", status=r.status_code, body=r.text[:200])
            return False
    except Exception as exc:
        log.error("gemini.unreachable", error=str(exc))
        return False


async def check_discord(client: httpx.AsyncClient) -> bool:
    """Validate DISCORD_BOT_TOKEN via Discord /users/@me endpoint."""
    if not DISCORD_BOT_TOKEN:
        log.error("discord.token.missing", hint="Set DISCORD_BOT_TOKEN in .env")
        return False
    try:
        headers = {"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
        r = await client.get("https://discord.com/api/v10/users/@me", headers=headers, timeout=10.0)
        if r.status_code == 200:
            data = r.json()
            log.info("discord.ok", bot=f"{data['username']}#{data.get('discriminator','0')}")
            return True
        else:
            log.error("discord.token.invalid", status=r.status_code, body=r.text[:200])
            return False
    except Exception as exc:
        log.error("discord.unreachable", error=str(exc))
        return False


# ── Main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    print("\n🚀 Space-Claw — Ignition Check\n")

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            check_ollama(client),
            check_gemini(client),
            check_discord(client),
        )

    labels = ["Ollama (local models)", "Gemini API (cloud tier)", "Discord bot token"]
    all_ok = True
    print()
    for label, ok in zip(labels, results, strict=True):
        status = "✅" if ok else "❌"
        print(f"  {status}  {label}")
        if not ok:
            all_ok = False

    print()
    if all_ok:
        print("All systems go. Run: uv run python -m agents.discord_bot\n")
    else:
        print("Fix the errors above, then re-run verify_ignition.py\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
