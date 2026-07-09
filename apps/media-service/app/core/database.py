"""asyncpg connection pool lifecycle + per-request connection dependency.

The database schema is provisioned externally (DDL in docs/database.md);
this service only opens a connection pool and runs queries.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Create the shared connection pool (called from the app lifespan)."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialized")
    return _pool


async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency yielding a pooled connection wrapped in a transaction."""
    pool = get_pool()
    async with pool.acquire() as connection:
        async with connection.transaction():
            yield connection
