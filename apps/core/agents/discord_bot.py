"""
Space-Claw Discord Bot — Primary control channel.

Commands:
  /ask <message>   — Send a task to the orchestrator
  /status          — Show orchestrator health + active models
  /tasks           — Dump current TASKS.md
  /models          — List available Ollama models

DM or #space-claw channel messages are also routed to the orchestrator
if the message starts with a mention or the LISTEN_ALL env var is set.
"""

import asyncio
import logging
import os
from pathlib import Path

import discord
import httpx
import structlog
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()

# ─── Logging ─────────────────────────────────────────────────────────────────

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

# ─── Config ──────────────────────────────────────────────────────────────────

BOT_TOKEN: str = os.environ["DISCORD_BOT_TOKEN"]           # required
GUILD_ID: int = int(os.environ["DISCORD_GUILD_ID"])        # your server ID
CHANNEL_ID: int = int(os.getenv("DISCORD_CHANNEL_ID", "0"))  # 0 = DMs only
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ORCHESTRATOR_MODEL: str = os.getenv("ORCHESTRATOR_MODEL", "llama3.1:8b")
WORKER_MODEL: str = os.getenv("WORKER_MODEL", "qwen3-coder:30b")
TASKS_PATH: Path = Path(os.getenv("TASKS_PATH", str(Path(__file__).parent.parent / "TASKS.md")))

# ─── Ollama helpers ──────────────────────────────────────────────────────────


async def ask_ollama(prompt: str, model: str | None = None) -> str:
    """Send a prompt to Ollama, return the response text."""
    chosen = model or ORCHESTRATOR_MODEL
    payload = {"model": chosen, "prompt": prompt, "stream": False}
    try:
        async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
            resp = await client.post("/api/generate", json=payload, timeout=120.0)
            resp.raise_for_status()
            return resp.json().get("response", "").strip()
    except Exception as exc:
        log.error("ollama.error", exc=str(exc))
        return f"⚠️ Ollama error: {exc}"


async def list_models() -> list[dict]:
    """Return available Ollama models."""
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
        resp = await client.get("/api/tags", timeout=10.0)
        resp.raise_for_status()
        return resp.json().get("models", [])


async def ping_ollama() -> bool:
    """Return True if Ollama is reachable."""
    try:
        async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
            r = await client.get("/", timeout=5.0)
            return r.status_code == 200
    except Exception:
        return False


# ─── Bot setup ───────────────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.message_content = True  # needed to read message text

client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)
guild = discord.Object(id=GUILD_ID)


# ─── Helper: split long responses ────────────────────────────────────────────

def chunk(text: str, limit: int = 1900) -> list[str]:
    """Split text into Discord-safe chunks (≤2000 chars)."""
    return [text[i : i + limit] for i in range(0, len(text), limit)]


# ─── Slash Commands ──────────────────────────────────────────────────────────


@tree.command(guild=guild, name="ask", description="Send a message to Space-Claw")
@app_commands.describe(message="What do you want to ask?")
async def ask_cmd(interaction: discord.Interaction, message: str) -> None:
    await interaction.response.defer(thinking=True)
    log.info("discord.ask", user=str(interaction.user), message=message)
    response = await ask_ollama(message)
    for part in chunk(response):
        await interaction.followup.send(f"```{part}```" if len(response) < 1800 else part)


@tree.command(guild=guild, name="status", description="Check Space-Claw status")
async def status_cmd(interaction: discord.Interaction) -> None:
    await interaction.response.defer(thinking=True)
    ollama_ok = await ping_ollama()
    models = await list_models() if ollama_ok else []
    embed = discord.Embed(
        title="🤖 Space-Claw Status",
        color=discord.Color.green() if ollama_ok else discord.Color.red(),
    )
    embed.add_field(
        name="Ollama",
        value=f"{'🟢 Online' if ollama_ok else '🔴 Offline'} — `{OLLAMA_BASE_URL}`",
        inline=False,
    )
    embed.add_field(name="Orchestrator model", value=f"`{ORCHESTRATOR_MODEL}`", inline=True)
    embed.add_field(name="Worker model", value=f"`{WORKER_MODEL}`", inline=True)
    if models:
        model_list = "\n".join(
            f"• `{m['name']}` ({round(m.get('size', 0) / 1e9, 1)} GB)"
            for m in models[:12]
        )
        embed.add_field(name=f"Loaded models ({len(models)})", value=model_list, inline=False)
    await interaction.followup.send(embed=embed)


@tree.command(guild=guild, name="tasks", description="Show current TASKS.md")
async def tasks_cmd(interaction: discord.Interaction) -> None:
    await interaction.response.defer(thinking=True)
    if not TASKS_PATH.exists():
        await interaction.followup.send("❌ `TASKS.md` not found.")
        return
    content = TASKS_PATH.read_text().strip()
    if not content:
        await interaction.followup.send("📋 `TASKS.md` is empty.")
        return
    for part in chunk(content):
        await interaction.followup.send(f"```md\n{part}\n```")


@tree.command(guild=guild, name="models", description="List available Ollama models")
async def models_cmd(interaction: discord.Interaction) -> None:
    await interaction.response.defer(thinking=True)
    ok = await ping_ollama()
    if not ok:
        await interaction.followup.send("❌ Ollama is offline.")
        return
    models = await list_models()
    if not models:
        await interaction.followup.send("⚠️ No models found. Run `ollama pull <model>`.")
        return
    lines = [
        f"• `{m['name']}` — {round(m.get('size', 0) / 1e9, 2)} GB"
        for m in models
    ]
    await interaction.followup.send("**Available models:**\n" + "\n".join(lines))


# ─── Message listener (DMs + channel) ────────────────────────────────────────


@client.event
async def on_message(message: discord.Message) -> None:
    """Route DMs and #space-claw channel mentions to the orchestrator."""
    if message.author.bot:
        return

    is_dm = isinstance(message.channel, discord.DMChannel)
    is_mention = client.user in message.mentions  # type: ignore[operator]
    in_channel = CHANNEL_ID and message.channel.id == CHANNEL_ID

    if not (is_dm or is_mention or in_channel):
        return

    # Strip the bot mention prefix if present
    prompt = message.content
    if client.user:
        prompt = prompt.replace(f"<@{client.user.id}>", "").strip()
    if not prompt:
        return

    log.info("discord.message", author=str(message.author), channel=str(message.channel))

    async with message.channel.typing():
        response = await ask_ollama(prompt)

    for part in chunk(response):
        await message.reply(part)


# ─── Startup ─────────────────────────────────────────────────────────────────


@client.event
async def on_ready() -> None:
    await tree.sync(guild=guild)
    log.info(
        "discord.ready",
        bot=str(client.user),
        guild_id=GUILD_ID,
        channel_id=CHANNEL_ID or "DMs only",
        ollama=OLLAMA_BASE_URL,
    )
    # Notify the target channel that the bot is online
    if CHANNEL_ID:
        ch = client.get_channel(CHANNEL_ID)
        if ch and isinstance(ch, discord.TextChannel):
            await ch.send("🤖 **Space-Claw online.** Type `/status` to check health.")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    client.run(BOT_TOKEN, log_handler=None)  # structlog handles logging
