FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi 'uvicorn[standard]' httpx pyyaml structlog python-dotenv pydantic

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
