#!/usr/bin/env python
"""Space-Claw Discord Bot — Entrypoint.

Starts the discord.py bot connected to CentralBrain.

Usage:
    uv run python start_discord_bot.py

Requires in .env:
    DISCORD_BOT_TOKEN
    DISCORD_GUILD_ID
    DISCORD_CHANNEL_ID
"""
import asyncio
import sys
from pathlib import Path

# Ensure repo root is on path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import structlog
import logging
import os

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()


async def main() -> None:
    from orchestration.central_brain import CentralBrain
    from channels.discord_channel import DiscordChannel

    log.info("space_claw.discord.starting")
    brain = CentralBrain()
    channel = DiscordChannel(brain)
    await channel.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("space_claw.discord.stopped")
