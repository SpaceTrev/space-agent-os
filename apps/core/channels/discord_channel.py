"""
discord_channel.py — Discord adapter for Space-Claw.

Responsibilities:
  - Connect as a bot via discord.py
  - Listen for messages in DISCORD_CHANNEL_ID (or DMs / @mentions)
  - Route incoming requests to the CentralBrain
  - Send rich embeds back: agent status, ticket creation, pipeline progress
  - Expose send_message() / send_embed() helpers for heartbeat and other services

Environment vars:
  DISCORD_TOKEN      Bot token (preferred; falls back to DISCORD_BOT_TOKEN)
  DISCORD_GUILD_ID   Server / guild ID (integer)
  DISCORD_CHANNEL_ID Channel ID the bot monitors (integer; 0 = DMs only)
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import discord
import structlog
from discord import app_commands

if TYPE_CHECKING:
    from orchestration.central_brain import CentralBrain

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ─── Config ──────────────────────────────────────────────────────────────────

BOT_TOKEN: str = os.getenv("DISCORD_TOKEN") or os.environ["DISCORD_BOT_TOKEN"]
GUILD_ID: int = int(os.environ["DISCORD_GUILD_ID"])
CHANNEL_ID: int = int(os.getenv("DISCORD_CHANNEL_ID", "0"))


# ─── Data types ──────────────────────────────────────────────────────────────


@dataclass
class IncomingRequest:
    """Normalised request passed from the Discord adapter to the CentralBrain."""

    id: str
    source: str          # "discord"
    author: str          # discord username
    author_id: int
    content: str
    channel_id: int
    timestamp: datetime


# ─── Discord channel adapter ─────────────────────────────────────────────────


class DiscordChannel:
    """
    Wraps a discord.py bot client.  Owns the bot lifecycle; routes messages to
    a CentralBrain instance injected at startup.

    Usage:
        brain = CentralBrain()
        channel = DiscordChannel(brain)
        await channel.run()          # blocks until bot disconnects
    """

    def __init__(self, brain: "CentralBrain") -> None:
        self._brain = brain

        intents = discord.Intents.default()
        intents.message_content = True
        self._client = discord.Client(intents=intents)
        self._tree = app_commands.CommandTree(self._client)
        self._guild = discord.Object(id=GUILD_ID)

        # Wire event handlers and slash commands
        self._client.event(self._on_ready)
        self._client.event(self._on_message)
        self._register_commands()

    # ── Lifecycle ─────────────────────────────────────────────────────────

    async def run(self) -> None:
        """Start the bot.  Blocks until disconnected."""
        await self._client.start(BOT_TOKEN)

    async def close(self) -> None:
        await self._client.close()

    # ── Outbound helpers ──────────────────────────────────────────────────

    async def send_message(self, content: str, channel_id: int | None = None) -> None:
        """Post a plain text message to a channel."""
        cid = channel_id or CHANNEL_ID
        if not cid:
            return
        ch = self._client.get_channel(cid)
        if ch and isinstance(ch, discord.TextChannel):
            for part in _chunk(content):
                await ch.send(part)

    async def send_embed(
        self,
        title: str,
        fields: dict[str, str],
        *,
        color: discord.Color | None = None,
        channel_id: int | None = None,
    ) -> None:
        """Post a rich embed to a channel."""
        cid = channel_id or CHANNEL_ID
        if not cid:
            return
        ch = self._client.get_channel(cid)
        if not ch or not isinstance(ch, discord.TextChannel):
            return
        embed = discord.Embed(
            title=title,
            color=color or discord.Color.blurple(),
            timestamp=datetime.now(timezone.utc),
        )
        for name, value in fields.items():
            embed.add_field(name=name, value=value or "—", inline=False)
        await ch.send(embed=embed)

    # ── Discord events ────────────────────────────────────────────────────

    async def _on_ready(self) -> None:
        await self._tree.sync(guild=self._guild)
        log.info(
            "discord.ready",
            bot=str(self._client.user),
            guild_id=GUILD_ID,
            channel_id=CHANNEL_ID or "DMs only",
        )
        if CHANNEL_ID:
            ch = self._client.get_channel(CHANNEL_ID)
            if ch and isinstance(ch, discord.TextChannel):
                await ch.send("🤖 **Space-Claw online.** Type `/ask` or mention me to start.")

    async def _on_message(self, message: discord.Message) -> None:
        if message.author.bot:
            return

        is_dm = isinstance(message.channel, discord.DMChannel)
        is_mention = self._client.user in message.mentions  # type: ignore[operator]
        in_channel = CHANNEL_ID and message.channel.id == CHANNEL_ID

        if not (is_dm or is_mention or in_channel):
            return

        content = message.content
        if self._client.user:
            content = content.replace(f"<@{self._client.user.id}>", "").strip()
        if not content:
            return

        log.info("discord.message", author=str(message.author), channel=str(message.channel))

        req = IncomingRequest(
            id=str(message.id),
            source="discord",
            author=str(message.author),
            author_id=message.author.id,
            content=content,
            channel_id=message.channel.id,
            timestamp=message.created_at or datetime.now(timezone.utc),
        )

        async with message.channel.typing():
            result = await self._brain.handle(req)

        for part in _chunk(result):
            await message.reply(part)

    # ── Slash commands ────────────────────────────────────────────────────

    def _register_commands(self) -> None:
        guild = self._guild
        tree = self._tree

        @tree.command(guild=guild, name="ask", description="Send a task to Space-Claw")
        @app_commands.describe(message="What should Space-Claw do?")
        async def ask_cmd(interaction: discord.Interaction, message: str) -> None:
            await interaction.response.defer(thinking=True)
            req = IncomingRequest(
                id=str(interaction.id),
                source="discord",
                author=str(interaction.user),
                author_id=interaction.user.id,
                content=message,
                channel_id=interaction.channel_id or CHANNEL_ID,
                timestamp=datetime.now(timezone.utc),
            )
            result = await self._brain.handle(req)
            for part in _chunk(result):
                await interaction.followup.send(part)

        @tree.command(guild=guild, name="status", description="Show Space-Claw system status")
        async def status_cmd(interaction: discord.Interaction) -> None:
            await interaction.response.defer(thinking=True)
            status = await self._brain.status()
            embed = discord.Embed(
                title="🤖 Space-Claw Status",
                color=discord.Color.green(),
                timestamp=datetime.now(timezone.utc),
            )
            for k, v in status.items():
                embed.add_field(name=k, value=str(v), inline=False)
            await interaction.followup.send(embed=embed)

        @tree.command(guild=guild, name="tasks", description="Show current TASKS.md")
        async def tasks_cmd(interaction: discord.Interaction) -> None:
            await interaction.response.defer(thinking=True)
            from pathlib import Path
            tasks_path = Path(__file__).parent.parent / "TASKS.md"
            if not tasks_path.exists():
                await interaction.followup.send("❌ `TASKS.md` not found.")
                return
            content = tasks_path.read_text(encoding="utf-8").strip()
            for part in _chunk(content, code_block="md"):
                await interaction.followup.send(part)

        @tree.command(guild=guild, name="swarm", description="Launch a multi-team swarm")
        @app_commands.describe(task="Complex task for the swarm")
        async def swarm_cmd(interaction: discord.Interaction, task: str) -> None:
            await interaction.response.defer(thinking=True)
            req = IncomingRequest(
                id=str(interaction.id),
                source="discord",
                author=str(interaction.user),
                author_id=interaction.user.id,
                content=f"/swarm {task}",
                channel_id=interaction.channel_id or CHANNEL_ID,
                timestamp=datetime.now(timezone.utc),
            )
            result = await self._brain.handle(req)
            for part in _chunk(result):
                await interaction.followup.send(part)


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _chunk(text: str, limit: int = 1900, code_block: str | None = None) -> list[str]:
    """Split text into Discord-safe chunks (≤2000 chars)."""
    parts = [text[i : i + limit] for i in range(0, max(len(text), 1), limit)]
    if code_block:
        return [f"```{code_block}\n{p}\n```" for p in parts]
    return parts


# ─── Entry point (standalone bot mode) ───────────────────────────────────────


async def _main() -> None:
    """Run the Discord bot in standalone mode (no CentralBrain wired)."""
    from orchestration.central_brain import CentralBrain

    brain = CentralBrain()
    channel = DiscordChannel(brain)
    log.info("discord_channel.starting")
    await channel.run()


if __name__ == "__main__":
    asyncio.run(_main())
