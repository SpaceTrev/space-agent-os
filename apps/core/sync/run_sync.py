# apps/core/sync/run_sync.py
"""Entry point: run push_state and poll_commands concurrently."""

import asyncio
import logging

from .push_state import push_state_loop
from .poll_commands import poll_commands_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("sync")


async def main() -> None:
    logger.info("Starting Supabase sync daemon")
    await asyncio.gather(
        push_state_loop(),
        poll_commands_loop(),
    )


if __name__ == "__main__":
    asyncio.run(main())
