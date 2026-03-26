"""CodeExecutionBackend — abstract interface and Docker implementation.

Provides a safe sandbox for running agent-generated code.
The DockerBackend runs code in a locked-down Alpine container:
  --network=none        no network access
  --cap-drop=ALL        no Linux capabilities
  --memory=512m         memory cap
  --cpus=1              CPU cap
  --rm                  auto-remove container after run
  --read-only           read-only root filesystem
  --tmpfs /tmp          writable temp dir only

Usage:
    backend = DockerBackend()
    result = await backend.run(language="python", code='print("hello")')
    print(result.stdout)

Config (env vars):
  SANDBOX_IMAGE         Docker image to use (default: python:3.12-alpine)
  SANDBOX_TIMEOUT       Execution timeout in seconds (default: 30)
  SANDBOX_MEMORY        Memory limit (default: 512m)
  SANDBOX_CPUS          CPU limit (default: 1)
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import textwrap
import uuid
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

SANDBOX_IMAGE: str = os.getenv("SANDBOX_IMAGE", "python:3.12-alpine")
SANDBOX_TIMEOUT: int = int(os.getenv("SANDBOX_TIMEOUT", "30"))
SANDBOX_MEMORY: str = os.getenv("SANDBOX_MEMORY", "512m")
SANDBOX_CPUS: str = os.getenv("SANDBOX_CPUS", "1")

# Language → interpreter/runner mapping
_RUNNERS: dict[str, tuple[str, str]] = {
    "python": ("python:3.12-alpine", "python /sandbox/code.py"),
    "python3": ("python:3.12-alpine", "python /sandbox/code.py"),
    "javascript": ("node:22-alpine", "node /sandbox/code.js"),
    "js": ("node:22-alpine", "node /sandbox/code.js"),
    "bash": ("alpine:3.19", "sh /sandbox/code.sh"),
    "sh": ("alpine:3.19", "sh /sandbox/code.sh"),
}

_EXTENSIONS: dict[str, str] = {
    "python": "py",
    "python3": "py",
    "javascript": "js",
    "js": "js",
    "bash": "sh",
    "sh": "sh",
}


@dataclass
class ExecutionResult:
    """Result of a sandboxed code execution."""
    run_id: str
    language: str
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False
    error: str | None = None

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out and self.error is None

    @property
    def output(self) -> str:
        """Combined stdout + stderr for convenience."""
        parts = []
        if self.stdout.strip():
            parts.append(self.stdout.strip())
        if self.stderr.strip():
            parts.append(f"[stderr]\n{self.stderr.strip()}")
        return "\n".join(parts)


# ── Abstract backend ──────────────────────────────────────────────────────────

class CodeExecutionBackend(ABC):
    """Abstract interface for code execution backends."""

    @abstractmethod
    async def run(
        self,
        code: str,
        *,
        language: str = "python",
        timeout: int = SANDBOX_TIMEOUT,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        """Execute `code` in the sandbox and return the result."""

    @abstractmethod
    async def available(self) -> bool:
        """Return True if the backend is reachable."""


# ── Docker backend ────────────────────────────────────────────────────────────

class DockerBackend(CodeExecutionBackend):
    """
    Executes code in a locked-down Docker container.

    Security constraints applied to every run:
      --network=none        Prevents all network I/O
      --cap-drop=ALL        Drops all Linux capabilities
      --memory              Caps RAM usage
      --cpus                Caps CPU usage
      --rm                  Container auto-removed after exit
      --read-only           Root FS is read-only
      --tmpfs /tmp:size=64m Writable scratchpad only (tmpfs, no persistence)
      --user 65534          Run as nobody (uid 65534)
    """

    def __init__(
        self,
        *,
        memory: str = SANDBOX_MEMORY,
        cpus: str = SANDBOX_CPUS,
        timeout: int = SANDBOX_TIMEOUT,
    ) -> None:
        self._memory = memory
        self._cpus = cpus
        self._timeout = timeout

    async def available(self) -> bool:
        """Check if Docker is installed and the daemon is running."""
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

    async def run(
        self,
        code: str,
        *,
        language: str = "python",
        timeout: int | None = None,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        """Run `code` in a sandboxed Docker container."""
        run_id = str(uuid.uuid4())[:8]
        effective_timeout = timeout or self._timeout
        lang_key = language.lower()

        if lang_key not in _RUNNERS:
            return ExecutionResult(
                run_id=run_id,
                language=language,
                exit_code=1,
                stdout="",
                stderr="",
                error=f"Unsupported language: {language}. Supported: {list(_RUNNERS)}",
            )

        image, cmd_str = _RUNNERS[lang_key]
        ext = _EXTENSIONS[lang_key]

        log.info(
            "sandbox.run_start",
            run_id=run_id,
            language=language,
            image=image,
            chars=len(code),
        )

        # Write code to a temp dir that we bind-mount read-only into the container
        with tempfile.TemporaryDirectory(prefix="space-claw-sandbox-") as tmpdir:
            code_path = Path(tmpdir) / f"code.{ext}"
            code_path.write_text(textwrap.dedent(code), encoding="utf-8")

            docker_cmd = [
                "docker", "run",
                "--rm",
                "--network=none",
                "--cap-drop=ALL",
                f"--memory={self._memory}",
                f"--cpus={self._cpus}",
                "--read-only",
                "--tmpfs", "/tmp:size=64m,noexec",
                "--user", "65534",
                "--volume", f"{tmpdir}:/sandbox:ro",
                "--workdir", "/sandbox",
            ]

            # Inject extra env vars (no secrets — caller's responsibility)
            for k, v in (env or {}).items():
                docker_cmd += ["-e", f"{k}={v}"]

            docker_cmd += [image, "sh", "-c", cmd_str]

            timed_out = False
            try:
                proc = await asyncio.create_subprocess_exec(
                    *docker_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                try:
                    stdout_b, stderr_b = await asyncio.wait_for(
                        proc.communicate(), timeout=float(effective_timeout)
                    )
                except asyncio.TimeoutError:
                    timed_out = True
                    proc.kill()
                    stdout_b, stderr_b = await proc.communicate()
                    log.warning("sandbox.timeout", run_id=run_id, timeout=effective_timeout)

                exit_code = proc.returncode or 0
                stdout = stdout_b.decode("utf-8", errors="replace")
                stderr = stderr_b.decode("utf-8", errors="replace")

            except Exception as exc:
                log.error("sandbox.error", run_id=run_id, error=str(exc))
                return ExecutionResult(
                    run_id=run_id,
                    language=language,
                    exit_code=1,
                    stdout="",
                    stderr="",
                    timed_out=False,
                    error=str(exc),
                )

        result = ExecutionResult(
            run_id=run_id,
            language=language,
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            timed_out=timed_out,
        )
        log.info(
            "sandbox.run_done",
            run_id=run_id,
            exit_code=exit_code,
            timed_out=timed_out,
            stdout_chars=len(stdout),
        )
        return result


# ── Subprocess backend (no Docker — dev/testing only) ─────────────────────────

class SubprocessBackend(CodeExecutionBackend):
    """
    UNSAFE — runs code directly in a subprocess on the host.
    Use only for local development and testing, never in production.
    """

    async def available(self) -> bool:
        return True

    async def run(
        self,
        code: str,
        *,
        language: str = "python",
        timeout: int = SANDBOX_TIMEOUT,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        run_id = str(uuid.uuid4())[:8]
        lang_key = language.lower()
        ext = _EXTENSIONS.get(lang_key, "py")
        interp = {"python": "python3", "python3": "python3",
                  "javascript": "node", "js": "node",
                  "bash": "bash", "sh": "bash"}.get(lang_key, "python3")

        log.warning("sandbox.subprocess_backend", run_id=run_id, note="UNSAFE — dev only")

        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False, mode="w") as f:
            f.write(textwrap.dedent(code))
            tmp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                interp, tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, **(env or {})},
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(), timeout=float(timeout)
                )
                timed_out = False
            except asyncio.TimeoutError:
                proc.kill()
                stdout_b, stderr_b = await proc.communicate()
                timed_out = True
        finally:
            Path(tmp_path).unlink(missing_ok=True)

        return ExecutionResult(
            run_id=run_id,
            language=language,
            exit_code=proc.returncode or 0,
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            timed_out=timed_out,
        )
