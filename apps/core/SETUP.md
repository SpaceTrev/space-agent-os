# Space-Claw — Setup Guide

Quick-start to get the core engine running with Gemini (cloud tier) and Discord (control plane).

---

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) installed
- [Ollama](https://ollama.ai) running locally with models pulled:
  ```
  ollama pull llama3.3:8b
  ollama pull qwen3-coder:30b-a3b
  ```
- A [Google AI Studio](https://aistudio.google.com) account (free tier works; Gemini Pro preferred)
- A Discord bot created at [discord.com/developers](https://discord.com/developers)

---

## Step 1 — Copy and fill in the environment file

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → **Get API key** |
| `DISCORD_BOT_TOKEN` | Developer Portal → your app → **Bot** → **Reset Token** |
| `DISCORD_GUILD_ID` | Discord: enable Developer Mode → right-click your server → **Copy Server ID** |
| `DISCORD_CHANNEL_ID` | Right-click the channel for the bot → **Copy Channel ID** |

Leave Ollama/model vars as-is unless Ollama runs on a non-default port.

---

## Step 2 — Install dependencies

From `apps/core/`:

```bash
uv sync
```

---

## Step 3 — Verify all connections

```bash
uv run python verify_ignition.py
```

Expected output:
```
🚀 Space-Claw — Ignition Check

  ✅  Ollama (local models)
  ✅  Gemini API (cloud tier)
  ✅  Discord bot token

All systems go. Run: uv run python -m agents.discord_bot
```

Fix any ❌ items before proceeding.

---

## Step 4 — Boot the Discord control plane

```bash
uv run python -m agents.discord_bot
```

The bot will post `🤖 Space-Claw online.` in your configured channel.

**Available slash commands:**
- `/ask <message>` — send a task to the orchestrator
- `/status` — health check (Ollama models, config)
- `/tasks` — dump current `TASKS.md`
- `/models` — list available Ollama models

---

## Model routing reference

| Tier | Model | Trigger |
|---|---|---|
| Orchestrator | `llama3.3:8b` (Ollama) | Heartbeat, triage, routing |
| Worker | `qwen3-coder:30b-a3b` (Ollama) | Default for all tasks |
| Cloud | `gemini/gemini-2.0-flash` (Gemini API) | `/architect`, `/refactor`, `/deep`, `/design`, `/cloud` |
