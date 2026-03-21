"""
Space-Claw Orchestrator — Tier 1 (Llama 3.3 / 8B)
Responsibilities:
  - Ping Ollama and confirm connectivity
  - List available local models
  - Route tasks to the appropriate tier (Worker or Architect)
  - Serve as the entry point for all agent dispatches
"""

import asyncio
import json
import logging
import os
from ipaddress import ip_address, ip_network
from typing import Any

import httpx
import structlog

# ─── Logging ─────────────────────────────────────────────────────────────────

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ─── Config ──────────────────────────────────────────────────────────────────

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ORCHESTRATOR_MODEL = os.getenv("ORCHESTRATOR_MODEL", "llama3.3:8b")
WORKER_MODEL = os.getenv("WORKER_MODEL", "qwen3-coder:30b-a3b")

# Comma-separated list of allowed IPs/CIDRs, e.g. "100.102.161.30,127.0.0.1"
# If unset, all IPs are allowed (local-only dev default).
_ALLOWED_IPS_RAW = os.getenv("ALLOWED_IPS", "")


# ─── IP Allowlist ─────────────────────────────────────────────────────────────


class AllowList:
    """Check caller IPs against a whitelist of IPs and/or CIDR ranges."""

    def __init__(self, raw: str) -> None:
        self._entries = [e.strip() for e in raw.split(",") if e.strip()]
        self._open = not self._entries  # if empty → open to all (dev mode)

    def is_allowed(self, ip: str) -> bool:
        if self._open:
            return True
        try:
            addr = ip_address(ip)
        except ValueError:
            return False
        for entry in self._entries:
            try:
                if "/" in entry:
                    if addr in ip_network(entry, strict=False):
                        return True
                elif addr == ip_address(entry):
                    return True
            except ValueError:
                continue
        return False

    @property
    def mode(self) -> str:
        return "open (dev)" if self._open else f"{len(self._entries)} entries"


ALLOW_LIST = AllowList(_ALLOWED_IPS_RAW)

# ─── Ollama Client ────────────────────────────────────────────────────────────


async def ping_ollama(client: httpx.AsyncClient) -> bool:
    """Check if Ollama is reachable and responding."""
    try:
        resp = await client.get("/", timeout=5.0)
        if resp.status_code == 200:
            log.info("ollama.ping", status="ok", url=OLLAMA_BASE_URL)
            return True
        log.warning("ollama.ping", status="unexpected", code=resp.status_code)
        return False
    except httpx.ConnectError:
        log.error("ollama.ping", status="unreachable", url=OLLAMA_BASE_URL)
        return False


async def list_models(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Fetch all models currently loaded/available in Ollama."""
    resp = await client.get("/api/tags", timeout=10.0)
    resp.raise_for_status()
    data = resp.json()
    models: list[dict[str, Any]] = data.get("models", [])
    return models


async def generate(
    client: httpx.AsyncClient,
    model: str,
    prompt: str,
    stream: bool = False,
) -> str:
    """Send a prompt to Ollama and return the full response text."""
    payload = {"model": model, "prompt": prompt, "stream": stream}
    resp = await client.post("/api/generate", json=payload, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "")


# ─── Model Tier Router ────────────────────────────────────────────────────────


class OrchestratorTier:
    """Decides which model tier handles a given task."""

    ARCHITECT_TRIGGERS = {"/architect", "/refactor", "/deep", "/design"}

    def route(self, task: str) -> str:
        """Return the model name to use for a given task string."""
        lowered = task.lower()
        if any(trigger in lowered for trigger in self.ARCHITECT_TRIGGERS):
            log.info("router.tier", selected="architect", reason="trigger_keyword")
            # Architect tier uses Claude via Anthropic API — handled outside Ollama
            return "architect"
        # Default: code/logic tasks go to the Worker tier
        if any(kw in lowered for kw in ["code", "implement", "function", "class", "debug", "fix"]):
            log.info("router.tier", selected="worker", model=WORKER_MODEL)
            return WORKER_MODEL
        # Fallback: orchestrator tier for routing, triage, summaries
        log.info("router.tier", selected="orchestrator", model=ORCHESTRATOR_MODEL)
        return ORCHESTRATOR_MODEL


# ─── Main ─────────────────────────────────────────────────────────────────────


async def main() -> None:
    router = OrchestratorTier()

    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
        # 1. Connectivity check
        ok = await ping_ollama(client)
        if not ok:
            log.error(
                "startup.failed",
                reason="Cannot reach Ollama",
                hint=f"Is Ollama running at {OLLAMA_BASE_URL}?",
            )
            return

        # 2. List available models
        models = await list_models(client)
        if not models:
            log.warning("models.empty", hint="Pull a model: `ollama pull llama3.3`")
        else:
            log.info("models.available", count=len(models))
            for m in models:
                log.info(
                    "model",
                    name=m.get("name"),
                    size_gb=round(m.get("size", 0) / 1e9, 2),
                    modified=m.get("modified_at", "?"),
                )

        # 3. Smoke test — route a quick orchestrator-tier ping prompt
        test_prompt = "Reply with exactly: SPACE-CLAW ONLINE"
        selected_model = router.route(test_prompt)

        if selected_model == "architect":
            log.info("smoketest.skip", reason="Architect tier requires Anthropic API key")
        else:
            log.info("smoketest.start", model=selected_model)
            try:
                response = await generate(client, selected_model, test_prompt)
                log.info("smoketest.result", response=response.strip())
            except httpx.HTTPStatusError as e:
                log.error(
                    "smoketest.failed",
                    status=e.response.status_code,
                    hint=f"Is model '{selected_model}' pulled? Run: ollama pull {selected_model}",
                )

        log.info(
            "orchestrator.ready",
            ollama=OLLAMA_BASE_URL,
            orchestrator=ORCHESTRATOR_MODEL,
            worker=WORKER_MODEL,
            allowlist=ALLOW_LIST.mode,
        )


if __name__ == "__main__":
    asyncio.run(main())
