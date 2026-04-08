FROM python:3.12-slim

WORKDIR /app

# Install uv (fast package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for Docker layer caching
COPY pyproject.toml uv.lock* ./

# Install dependencies (no dev extras)
RUN uv sync --frozen --no-dev

# Copy source code
COPY . .

# Railway injects $PORT — default to 8000 for local Docker runs
ENV API_PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-$API_PORT}"]
