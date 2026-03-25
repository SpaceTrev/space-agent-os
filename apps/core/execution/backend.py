"""
backend.py — Sandboxed code execution backends.

Abstract base class + Docker implementation.

The DockerBackend runs untrusted code inside a hardened Alpine container with:
  --network=none       no outbound network access
  --cap-drop=ALL       no Linux capabilities
  --memory=512m        capped RAM
  --cpus=1             single CPU core
  --read-only          read-only root filesystem
  --rm                 auto-removed after exit
  --tmpfs /tmp         writable scratch space only

Usage:
    backend = DockerBackend()
    result = await backend.run("python3", "print(1 + 1)", timeout=10)
    print(result.stdout)  # "2"

Adding a new backend (e.g. WASM, Firecracker):
    class WasmBackend(ExecutionBackend):
        async def run(self, language, code, *, timeout=30, env=None) -> ExecutionResult:
            ...
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ─── Language → Docker image mapping ─────────────────────────────────────────

_IMAGES: dict[str, str] = {
    "python3":    "python:3.12-alpine",
    "python":     "python:3.12-alpine",
    "node":       "node:20-alpine",
    "javascript": "node:20-alpine",
    "typescript": "node:20-alpine",
    "bash":       "alpine:3.19",
    "sh":         "alpine:3.19",
}

_ENTRYPOINTS: dict[str, list[str]] = {
    "python3":    ["python3", "-c"],
    "python":     ["python3", "-c"],
    "node":       ["node", "-e"],
    "javascript": ["node", "-e"],
    "typescript": ["node", "--input-type=module", "-e"],
    "bash":       ["sh", "-c"],
    "sh":         ["sh", "-c"],
}


# ─── Result type ──────────────────────────────────────────────────────────────


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out

    def __str__(self) -> str:
        if self.timed_out:
            return "⏱ Execution timed out"
        if self.success:
            return self.stdout.strip()
        return f"Exit {self.exit_code}\n{self.stderr.strip()}"


# ─── Abstract base ────────────────────────────────────────────────────────────


class ExecutionBackend(ABC):
    """
    Abstract sandboxed code execution backend.

    All implementations must be async and honour the timeout parameter.
    """

    @abstractmethod
    async def run(
        self,
        language: str,
        code: str,
        *,
        timeout: float = 30.0,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        """Execute code in the sandbox and return the result."""
        ...

    async def is_available(self) -> bool:
        """Return True if this backend can execute code right now."""
        return True


# ─── Docker backend ───────────────────────────────────────────────────────────


class DockerBackend(ExecutionBackend):
    """
    Executes code inside a hardened Docker container.

    Security properties:
      --network=none      — no outbound or inbound network
      --cap-drop=ALL      — zero Linux capabilities
      --security-opt=no-new-privileges — cannot escalate privileges
      --read-only         — root filesystem is read-only
      --tmpfs /tmp:size=64m — writable scratch only
      --memory=512m       — OOM kill at 512 MB
      --cpus=1            — single core
      --rm                — container deleted after exit
      --user=nobody       — runs as unprivileged user
    """

    def __init__(
        self,
        memory: str = "512m",
        cpus: str = "1",
        tmpfs_size: str = "64m",
    ) -> None:
        self._memory = memory
        self._cpus = cpus
        self._tmpfs_size = tmpfs_size

    async def run(
        self,
        language: str,
        code: str,
        *,
        timeout: float = 30.0,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        lang = language.lower()
        image = _IMAGES.get(lang)
        entrypoint = _ENTRYPOINTS.get(lang)

        if not image or not entrypoint:
            return ExecutionResult(
                stdout="",
                stderr=f"Unsupported language: '{language}'. Supported: {', '.join(_IMAGES)}",
                exit_code=1,
            )

        cmd = self._build_command(image, entrypoint, code, env or {})
        log.info("execution.start", language=lang, image=image, code_chars=len(code))

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                log.warning("execution.timeout", language=lang, timeout=timeout)
                return ExecutionResult(stdout="", stderr="", exit_code=-1, timed_out=True)

            result = ExecutionResult(
                stdout=stdout_bytes.decode("utf-8", errors="replace"),
                stderr=stderr_bytes.decode("utf-8", errors="replace"),
                exit_code=proc.returncode or 0,
            )
            log.info(
                "execution.done",
                language=lang,
                exit_code=result.exit_code,
                stdout_chars=len(result.stdout),
            )
            return result

        except FileNotFoundError:
            return ExecutionResult(
                stdout="",
                stderr="Docker not found. Is Docker installed and in PATH?",
                exit_code=127,
            )

    def _build_command(
        self,
        image: str,
        entrypoint: list[str],
        code: str,
        env: dict[str, str],
    ) -> list[str]:
        cmd = [
            "docker", "run",
            "--rm",
            "--network=none",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--read-only",
            f"--tmpfs=/tmp:size={self._tmpfs_size}",
            f"--memory={self._memory}",
            f"--cpus={self._cpus}",
            "--user=nobody",
        ]
        for key, value in env.items():
            cmd += ["--env", f"{key}={value}"]
        cmd.append(image)
        cmd.extend(entrypoint)
        cmd.append(code)
        return cmd

    async def is_available(self) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "info",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.wait()
            return proc.returncode == 0
        except FileNotFoundError:
            return False


# ─── Null backend (testing / CI without Docker) ───────────────────────────────


class NullBackend(ExecutionBackend):
    """
    Stub backend that always returns a canned response.
    Useful for tests and environments without Docker.
    """

    async def run(
        self,
        language: str,
        code: str,
        *,
        timeout: float = 30.0,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        log.warning("execution.null_backend", language=language)
        return ExecutionResult(
            stdout=f"[NullBackend] Would execute {language} code ({len(code)} chars)",
            stderr="",
            exit_code=0,
        )

    async def is_available(self) -> bool:
        return True


# ─── Factory ─────────────────────────────────────────────────────────────────


async def get_backend() -> ExecutionBackend:
    """Return the best available backend (Docker preferred, Null as fallback)."""
    docker = DockerBackend()
    if await docker.is_available():
        return docker
    log.warning("execution.docker_unavailable", fallback="NullBackend")
    return NullBackend()
