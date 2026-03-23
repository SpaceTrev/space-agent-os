'''Space-Claw git automation helpers.

Thin asyncio wrappers around git subprocesses.  All functions accept a
repo_path (str | Path) so they work with any local repository.

Functions:
  get_diff(repo_path)                         → str (unified diff)
  create_branch(repo_path, branch_name)       → None
  commit_files(repo_path, files, message)     → str (commit sha)
  get_repo_context(repo_path)                 → str (log + status summary)
'''
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv('LOG_LEVEL', 'INFO'))
    ),
)
log = structlog.get_logger()


async def _run_git(
    *args: str,
    cwd: Path,
    check: bool = True,
) -> tuple[int, str, str]:
    '''Run a git command and return (returncode, stdout, stderr).'''
    cmd = ('git',) + args
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout_b, stderr_b = await proc.communicate()
    stdout = stdout_b.decode('utf-8', errors='replace').strip()
    stderr = stderr_b.decode('utf-8', errors='replace').strip()
    rc = proc.returncode or 0
    if check and rc != 0:
        raise RuntimeError(
            f'git {" ".join(args)} failed (rc={rc}): {stderr or stdout}'
        )
    return rc, stdout, stderr


def _resolve(repo_path: str | Path) -> Path:
    return Path(repo_path).expanduser().resolve()


async def get_diff(repo_path: str | Path) -> str:
    '''Return unified diff of all staged + unstaged changes.

    Returns empty string if the working tree is clean.
    '''
    path = _resolve(repo_path)
    _, staged, _ = await _run_git('diff', '--cached', cwd=path)
    _, unstaged, _ = await _run_git('diff', cwd=path)
    diff = '\n'.join(filter(None, [staged, unstaged]))
    log.debug('git_ops.diff', repo=str(path), chars=len(diff))
    return diff


async def create_branch(repo_path: str | Path, branch_name: str) -> None:
    '''Create and checkout a new branch.

    Raises RuntimeError if the branch already exists.
    '''
    path = _resolve(repo_path)
    await _run_git('checkout', '-b', branch_name, cwd=path)
    log.info('git_ops.branch_created', repo=str(path), branch=branch_name)


async def commit_files(
    repo_path: str | Path,
    files: list[str | Path],
    message: str,
) -> str:
    '''Stage the given files and commit them.

    Returns the full commit SHA of the new commit.
    '''
    path = _resolve(repo_path)
    str_files = [str(f) for f in files]
    await _run_git('add', '--', *str_files, cwd=path)
    await _run_git('commit', '-m', message, cwd=path)
    _, sha, _ = await _run_git('rev-parse', 'HEAD', cwd=path)
    log.info('git_ops.committed', repo=str(path), sha=sha[:12], files=len(str_files))
    return sha


async def get_repo_context(repo_path: str | Path) -> str:
    '''Return a concise repo summary: last 5 commits + working-tree status.

    Useful as context injection for LLM prompts.
    '''
    path = _resolve(repo_path)
    _, log_out, _ = await _run_git(
        'log', '--oneline', '-5', cwd=path, check=False
    )
    _, status_out, _ = await _run_git('status', '--short', cwd=path, check=False)
    _, diff_stat, _ = await _run_git(
        'diff', '--stat', 'HEAD', cwd=path, check=False
    )
    parts = []
    if log_out:
        parts.append(f'Recent commits:\n{log_out}')
    if status_out:
        parts.append(f'Working tree:\n{status_out}')
    if diff_stat:
        parts.append(f'Changes vs HEAD:\n{diff_stat}')
    context = '\n\n'.join(parts) if parts else '(clean repository)'
    log.debug('git_ops.context', repo=str(path), chars=len(context))
    return context
