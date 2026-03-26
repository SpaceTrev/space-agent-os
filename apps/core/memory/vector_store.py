"""VectorStore — sqlite-vec powered agent memory for Space-Claw.

Provides persistent, queryable memory for agents using:
  - sqlite3    (stdlib) for the base database
  - sqlite-vec (extension) for approximate nearest-neighbour search
  - httpx      for embedding generation via Ollama /api/embeddings

Memory entries are:
  - Text snippets with an embedding vector (384-dim or 768-dim)
  - Tagged by agent role, session, and source
  - Queryable by semantic similarity (cosine distance via sqlite-vec)

Setup:
  pip install sqlite-vec          # installs the Python wheel + .so extension
  uv add sqlite-vec               # preferred (matches pyproject.toml pattern)

The vector extension is loaded at connection time via sqlite3.load_extension().
If sqlite-vec is not installed, VectorStore degrades gracefully to text-only
full-text-search using SQLite FTS5.

Config (env vars):
  MEMORY_DB_PATH          Path to the SQLite file (default: apps/core/memory/memory.db)
  EMBED_MODEL             Ollama model for embeddings (default: nomic-embed-text)
  EMBED_DIM               Embedding dimension (default: 768)
  OLLAMA_BASE_URL         Ollama server (default: http://localhost:11434)
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import struct
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import structlog

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
log = structlog.get_logger()

REPO_ROOT = Path(__file__).parent.parent
MEMORY_DB_PATH: Path = Path(
    os.getenv("MEMORY_DB_PATH", str(REPO_ROOT / "memory" / "memory.db"))
)
EMBED_MODEL: str = os.getenv("EMBED_MODEL", "nomic-embed-text")
EMBED_DIM: int = int(os.getenv("EMBED_DIM", "768"))
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# sqlite-vec extension name (loaded via load_extension)
# On macOS: vec0.dylib  |  Linux: vec0.so  |  loaded as 'vec0'
_VEC_EXT = "vec0"


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class MemoryEntry:
    """A single memory record stored in the vector store."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    agent_role: str = ""
    session_id: str = ""
    source: str = ""  # e.g. 'task', 'observation', 'code', 'user_message'
    tags: list[str] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    metadata: dict[str, Any] = field(default_factory=dict)
    # Populated after embedding
    embedding: list[float] | None = None

    @property
    def tags_json(self) -> str:
        return json.dumps(self.tags)

    @property
    def metadata_json(self) -> str:
        return json.dumps(self.metadata)


@dataclass
class SearchResult:
    """A memory entry with its similarity score."""
    entry: MemoryEntry
    distance: float  # lower = more similar (cosine distance)

    @property
    def similarity(self) -> float:
        """Cosine similarity: 1 - distance."""
        return max(0.0, 1.0 - self.distance)


# ── Embedding helpers ─────────────────────────────────────────────────────────

def _pack_vector(vec: list[float]) -> bytes:
    """Pack a float list into little-endian IEEE 754 binary (sqlite-vec format)."""
    return struct.pack(f"{len(vec)}f", *vec)


def _unpack_vector(blob: bytes) -> list[float]:
    """Unpack a sqlite-vec binary blob back to a float list."""
    count = len(blob) // 4
    return list(struct.unpack(f"{count}f", blob))


async def embed_text(text: str, *, model: str = EMBED_MODEL) -> list[float]:
    """Generate an embedding vector via Ollama /api/embeddings."""
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL) as client:
        resp = await client.post(
            "/api/embeddings",
            json={"model": model, "prompt": text},
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        vec = data.get("embedding", [])
        if not vec:
            raise RuntimeError(f"Ollama returned empty embedding for model {model}")
        return vec


# ── VectorStore ───────────────────────────────────────────────────────────────

class VectorStore:
    """
    Persistent agent memory backed by SQLite + sqlite-vec.

    If sqlite-vec is unavailable, falls back to FTS5 full-text search
    (no vector similarity, but still functional for keyword retrieval).
    """

    def __init__(
        self,
        db_path: Path = MEMORY_DB_PATH,
        embed_dim: int = EMBED_DIM,
    ) -> None:
        self._db_path = db_path
        self._embed_dim = embed_dim
        self._vec_available = False
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = self._connect()
        self._init_schema()

    # ── Connection & schema ───────────────────────────────────────────────────

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(
            str(self._db_path),
            check_same_thread=False,
        )
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")

        # Try to load sqlite-vec extension
        try:
            conn.enable_load_extension(True)
            conn.load_extension(_VEC_EXT)
            self._vec_available = True
            log.info("memory.vec_loaded", db=str(self._db_path))
        except Exception as exc:
            self._vec_available = False
            log.warning(
                "memory.vec_unavailable",
                reason=str(exc),
                fallback="FTS5 text search",
            )
        return conn

    def _init_schema(self) -> None:
        """Create tables on first run."""
        with self._conn:
            # Main memory table
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id          TEXT PRIMARY KEY,
                    content     TEXT NOT NULL,
                    agent_role  TEXT NOT NULL DEFAULT '',
                    session_id  TEXT NOT NULL DEFAULT '',
                    source      TEXT NOT NULL DEFAULT '',
                    tags        TEXT NOT NULL DEFAULT '[]',
                    metadata    TEXT NOT NULL DEFAULT '{}',
                    created_at  TEXT NOT NULL
                )
            """)

            # FTS5 fallback index (always created)
            self._conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
                USING fts5(
                    content,
                    agent_role,
                    tags,
                    content='memories',
                    content_rowid='rowid'
                )
            """)

            # sqlite-vec virtual table (created only if extension loaded)
            if self._vec_available:
                self._conn.execute(f"""
                    CREATE VIRTUAL TABLE IF NOT EXISTS memory_vss
                    USING vec0(
                        memory_id TEXT,
                        embedding float[{self._embed_dim}]
                    )
                """)

            log.info(
                "memory.schema_ready",
                vec=self._vec_available,
                fts=True,
                db=str(self._db_path),
            )

    # ── Write ─────────────────────────────────────────────────────────────────

    async def add(self, entry: MemoryEntry) -> str:
        """Embed and store a memory entry. Returns the entry ID."""
        start = time.monotonic()

        # Generate embedding
        try:
            vec = await embed_text(entry.content)
            entry.embedding = vec
        except Exception as exc:
            log.warning("memory.embed_failed", error=str(exc), content=entry.content[:60])
            entry.embedding = None

        with self._conn:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO memories
                    (id, content, agent_role, session_id, source, tags, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry.id,
                    entry.content,
                    entry.agent_role,
                    entry.session_id,
                    entry.source,
                    entry.tags_json,
                    entry.metadata_json,
                    entry.created_at,
                ),
            )

            # FTS5 index
            self._conn.execute(
                """
                INSERT OR REPLACE INTO memories_fts(rowid, content, agent_role, tags)
                SELECT rowid, content, agent_role, tags FROM memories WHERE id = ?
                """,
                (entry.id,),
            )

            # Vector index
            if self._vec_available and entry.embedding:
                blob = _pack_vector(entry.embedding)
                self._conn.execute(
                    "INSERT OR REPLACE INTO memory_vss(memory_id, embedding) VALUES (?, ?)",
                    (entry.id, blob),
                )

        elapsed = round(time.monotonic() - start, 3)
        log.info(
            "memory.added",
            id=entry.id[:8],
            role=entry.agent_role,
            chars=len(entry.content),
            elapsed_s=elapsed,
            vec=entry.embedding is not None,
        )
        return entry.id

    # ── Search ────────────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        *,
        top_k: int = 5,
        agent_role: str | None = None,
        source: str | None = None,
        min_similarity: float = 0.0,
    ) -> list[SearchResult]:
        """
        Semantic search via sqlite-vec (cosine distance), or FTS5 keyword
        fallback if sqlite-vec is unavailable.
        """
        if self._vec_available:
            return await self._vector_search(
                query, top_k=top_k,
                agent_role=agent_role, source=source,
                min_similarity=min_similarity,
            )
        return self._fts_search(query, top_k=top_k, agent_role=agent_role, source=source)

    async def _vector_search(
        self,
        query: str,
        *,
        top_k: int,
        agent_role: str | None,
        source: str | None,
        min_similarity: float,
    ) -> list[SearchResult]:
        """ANN search via sqlite-vec."""
        try:
            q_vec = await embed_text(query)
        except Exception as exc:
            log.warning("memory.search_embed_failed", error=str(exc))
            return self._fts_search(query, top_k=top_k, agent_role=agent_role, source=source)

        blob = _pack_vector(q_vec)
        rows = self._conn.execute(
            f"""
            SELECT vss.memory_id, vss.distance, m.content, m.agent_role,
                   m.session_id, m.source, m.tags, m.metadata, m.created_at
            FROM memory_vss vss
            JOIN memories m ON vss.memory_id = m.id
            WHERE vss.embedding MATCH ?
              AND k = ?
              {"AND m.agent_role = ?" if agent_role else ""}
              {"AND m.source = ?" if source else ""}
            ORDER BY vss.distance
            """,
            (blob, top_k, *([agent_role] if agent_role else []), *([source] if source else [])),
        ).fetchall()

        results = []
        for row in rows:
            mem_id, dist, content, role, sess, src, tags_j, meta_j, ts = row
            if (1.0 - dist) < min_similarity:
                continue
            entry = MemoryEntry(
                id=mem_id, content=content, agent_role=role,
                session_id=sess, source=src,
                tags=json.loads(tags_j), metadata=json.loads(meta_j),
                created_at=ts,
            )
            results.append(SearchResult(entry=entry, distance=float(dist)))
        return results

    def _fts_search(
        self,
        query: str,
        *,
        top_k: int,
        agent_role: str | None,
        source: str | None,
    ) -> list[SearchResult]:
        """Full-text search fallback using FTS5 BM25 ranking."""
        fts_query = " ".join(f'"{w}"' for w in query.split() if w)
        filter_clause = ""
        params: list[Any] = [fts_query]
        if agent_role:
            filter_clause += " AND m.agent_role = ?"
            params.append(agent_role)
        if source:
            filter_clause += " AND m.source = ?"
            params.append(source)
        params.append(top_k)

        try:
            rows = self._conn.execute(
                f"""
                SELECT m.id, m.content, m.agent_role, m.session_id, m.source,
                       m.tags, m.metadata, m.created_at,
                       bm25(memories_fts) AS score
                FROM memories_fts fts
                JOIN memories m ON fts.rowid = m.rowid
                WHERE memories_fts MATCH ?
                {filter_clause}
                ORDER BY score
                LIMIT ?
                """,
                params,
            ).fetchall()
        except sqlite3.OperationalError:
            return []

        results = []
        for row in rows:
            mem_id, content, role, sess, src, tags_j, meta_j, ts, score = row
            # BM25 returns negative scores (lower = more relevant); normalise to [0,1]
            dist = min(1.0, abs(float(score)) / 10.0)
            entry = MemoryEntry(
                id=mem_id, content=content, agent_role=role,
                session_id=sess, source=src,
                tags=json.loads(tags_j), metadata=json.loads(meta_j),
                created_at=ts,
            )
            results.append(SearchResult(entry=entry, distance=dist))
        return results

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def get(self, memory_id: str) -> MemoryEntry | None:
        """Fetch a single memory by ID."""
        row = self._conn.execute(
            "SELECT id, content, agent_role, session_id, source, tags, metadata, created_at "
            "FROM memories WHERE id = ?",
            (memory_id,),
        ).fetchone()
        if not row:
            return None
        mem_id, content, role, sess, src, tags_j, meta_j, ts = row
        return MemoryEntry(
            id=mem_id, content=content, agent_role=role,
            session_id=sess, source=src,
            tags=json.loads(tags_j), metadata=json.loads(meta_j),
            created_at=ts,
        )

    def recent(
        self,
        *,
        limit: int = 20,
        agent_role: str | None = None,
    ) -> list[MemoryEntry]:
        """Return the most recently added memories."""
        params: list[Any] = []
        where = ""
        if agent_role:
            where = "WHERE agent_role = ?"
            params.append(agent_role)
        params.append(limit)
        rows = self._conn.execute(
            f"SELECT id, content, agent_role, session_id, source, tags, metadata, created_at "
            f"FROM memories {where} ORDER BY created_at DESC LIMIT ?",
            params,
        ).fetchall()
        return [
            MemoryEntry(
                id=r[0], content=r[1], agent_role=r[2],
                session_id=r[3], source=r[4],
                tags=json.loads(r[5]), metadata=json.loads(r[6]),
                created_at=r[7],
            )
            for r in rows
        ]

    def count(self) -> int:
        """Return total number of stored memories."""
        return self._conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]

    def close(self) -> None:
        """Close the SQLite connection."""
        self._conn.close()

    def __enter__(self) -> "VectorStore":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
