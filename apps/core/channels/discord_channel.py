"""discord_channel.py — Discord adapter for Space-Claw.

Uses discord.py 2.x client subclass pattern (setup_hook + on_ready).
Slash commands: /ask /status /tasks /swarm
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

BOT_TOKEN: str = os.getenv("DISCORD_TOKEN") or os.environ["DISCORD_BOT_TOKEN"]
GUILD_ID: int = int(os.environ["DISCORD_GUILD_ID"])
CHANNEL_ID: int = int(os.getenv("DISCORD_CHANNEL_ID", "0"))


@dataclass
class IncomingRequest:
    id: str
    source: str
    author: str
    author_id: int
    content: str
    channel_id: int
    timestamp: datetime


def _chunk(text: str, limit: int = 1900, code_block: str | None = None) -> list[str]:
    parts = [text[i:i + limit] for i in range(0, max(len(text), 1), limit)]
    if code_block:
        return [f"```{code_block}\n{p}\n```" for p in parts]
    return parts


def _to_brain_request(req: IncomingRequest, history: list[dict[str, str]] | None = None) -> Any:
    from orchestration.central_brain import BrainRequest
    return BrainRequest(
        id=req.id,
        goal=req.content,
        channel="discord",
        priority="NORMAL",
        metadata={"author": req.author, "author_id": req.author_id},
        history=history or [],
    )


class _SpaceClawClient(discord.Client):
    """discord.py 2.x subclass — events fire via setup_hook + overrides."""

    def __init__(self, brain: "CentralBrain") -> None:
        intents = discord.Intents.default()
        if os.getenv("DISCORD_MESSAGE_CONTENT_INTENT", "").lower() == "true":
            intents.message_content = True
        super().__init__(intents=intents)
        self._brain = brain
        self.tree = app_commands.CommandTree(self)
        self._guild_obj = discord.Object(id=GUILD_ID)
        self._register_commands()

    async def setup_hook(self) -> None:
        """Runs before on_ready — sync slash commands to guild."""
        self.tree.copy_global_to(guild=self._guild_obj)
        synced = await self.tree.sync(guild=self._guild_obj)
        log.info("discord.commands_synced", count=len(synced))

    async def on_ready(self) -> None:
        log.info("discord.ready", bot=str(self.user), guild_id=GUILD_ID, channel_id=CHANNEL_ID)
        print(f"[Space-Claw] Discord online: {self.user}", flush=True)

    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot:
            return
        is_dm = isinstance(message.channel, discord.DMChannel)
        is_mention = self.user in message.mentions if self.user else False
        in_channel = CHANNEL_ID and message.channel.id == CHANNEL_ID
        if not (is_dm or is_mention or in_channel):
            return
        content = message.content
        if self.user:
            content = content.replace(f"<@{self.user.id}>", "").strip()
        if not content:
            return

        from memory.conversation import append_message, get_history
        channel_id = message.channel.id
        history = get_history(channel_id)
        append_message(channel_id, "user", content, author=str(message.author))

        req = IncomingRequest(
            id=str(message.id), source="discord", author=str(message.author),
            author_id=message.author.id, content=content,
            channel_id=channel_id,
            timestamp=message.created_at or datetime.now(timezone.utc),
        )
        async with message.channel.typing():
            brain_req = _to_brain_request(req, history=history)
            response = await self._brain.handle(brain_req)
            result = response.output if response.output else (response.error or "⚠️ No output.")

        append_message(channel_id, "assistant", result)
        for part in _chunk(result):
            await message.reply(part)

    def _register_commands(self) -> None:
        tree = self.tree
        guild = self._guild_obj

        @tree.command(guild=guild, name="ask", description="Send a task to Space-Claw")
        @app_commands.describe(message="What should Space-Claw do?")
        async def ask_cmd(interaction: discord.Interaction, message: str) -> None:
            await interaction.response.defer(thinking=True)
            from memory.conversation import append_message, get_history
            channel_id = interaction.channel_id or CHANNEL_ID
            history = get_history(channel_id)
            append_message(channel_id, "user", message, author=str(interaction.user))
            req = IncomingRequest(
                id=str(interaction.id), source="discord", author=str(interaction.user),
                author_id=interaction.user.id, content=message,
                channel_id=channel_id,
                timestamp=datetime.now(timezone.utc),
            )
            brain_req = _to_brain_request(req, history=history)
            response = await self._brain.handle(brain_req)
            result = response.output if response.output else (response.error or "⚠️ No output.")
            append_message(channel_id, "assistant", result)
            for part in _chunk(result):
                await interaction.followup.send(part)

        @tree.command(guild=guild, name="status", description="Show Space-Claw system status")
        async def status_cmd(interaction: discord.Interaction) -> None:
            await interaction.response.defer(thinking=True)
            status = await self._brain.status()
            embed = discord.Embed(
                title="🛸 Space-Claw Status",
                color=discord.Color.blurple(),
                timestamp=datetime.now(timezone.utc),
            )
            for k, v in status.items():
                embed.add_field(name=k, value=str(v), inline=False)
            await interaction.followup.send(embed=embed)

        @tree.command(guild=guild, name="tasks", description="Show current task queue")
        async def tasks_cmd(interaction: discord.Interaction) -> None:
            await interaction.response.defer(thinking=True)
            from pathlib import Path
            tasks_path = Path(__file__).parent.parent / "TASKS.md"
            if not tasks_path.exists():
                await interaction.followup.send("❌ TASKS.md not found.")
                return
            content = tasks_path.read_text(encoding="utf-8").strip()
            for part in _chunk(content, code_block="md"):
                await interaction.followup.send(part)

        @tree.command(guild=guild, name="swarm", description="Launch a multi-team swarm")
        @app_commands.describe(task="Complex task for the swarm")
        async def swarm_cmd(interaction: discord.Interaction, task: str) -> None:
            await interaction.response.defer(thinking=True)
            req = IncomingRequest(
                id=str(interaction.id), source="discord", author=str(interaction.user),
                author_id=interaction.user.id, content=f"/swarm {task}",
                channel_id=interaction.channel_id or CHANNEL_ID,
                timestamp=datetime.now(timezone.utc),
            )
            brain_req = _to_brain_request(req)
            response = await self._brain.handle(brain_req)
            result = response.output if response.output else (response.error or "⚠️ No output.")
            for part in _chunk(result):
                await interaction.followup.send(part)


class DiscordChannel:
    """Public interface — wraps _SpaceClawClient."""

    def __init__(self, brain: "CentralBrain") -> None:
        self._client = _SpaceClawClient(brain)

    async def run(self) -> None:
        async with self._client:
            await self._client.start(BOT_TOKEN)

    async def close(self) -> None:
        await self._client.close()

    async def send_message(self, content: str, channel_id: int | None = None) -> None:
        cid = channel_id or CHANNEL_ID
        ch = self._client.get_channel(cid)
        if ch and isinstance(ch, discord.TextChannel):
            for part in _chunk(content):
                await ch.send(part)


async def _main() -> None:
    from orchestration.central_brain import CentralBrain
    brain = CentralBrain()
    channel = DiscordChannel(brain)
    log.info("discord_channel.starting")
    await channel.run()


if __name__ == "__main__":
    asyncio.run(_main())
