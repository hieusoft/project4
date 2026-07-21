"""asyncpg connection pool lifecycle + per-request connection dependency.

The database schema itself is provisioned externally (DDL in docs/database.md);
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
        # Auto-migrate missing username column (if user pulled new code but DB wasn't recreated)
        async with _pool.acquire() as conn:
            try:
                # Check if table exists first
                table_exists = await conn.fetchval("SELECT 1 FROM information_schema.tables WHERE table_name='accounts'")
                if table_exists:
                    column_exists = await conn.fetchval("SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='username'")
                    if not column_exists:
                        await conn.execute("ALTER TABLE accounts ADD COLUMN username varchar(30);")
                        await conn.execute("UPDATE accounts SET username = 'u_' || substr(id::text, 1, 8) WHERE username IS NULL;")
                        await conn.execute("ALTER TABLE accounts ALTER COLUMN username SET NOT NULL;")
                        await conn.execute("ALTER TABLE accounts ADD CONSTRAINT accounts_username_key UNIQUE (username);")
            except Exception:
                pass  # Ignore migration errors to prevent server crash
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
