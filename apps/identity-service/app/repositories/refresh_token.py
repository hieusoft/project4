"""Data access for refresh_tokens (only hashes are stored)."""
from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

from app.models.domain import RefreshToken

_COLUMNS = (
    "id, account_id, token_hash, device_info, expires_at, revoked_at, created_at"
)


class RefreshTokenRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        account_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        device_info: str | None,
    ) -> RefreshToken:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO refresh_tokens (account_id, token_hash, expires_at, device_info)
            VALUES ($1, $2, $3, $4)
            RETURNING {_COLUMNS}
            """,
            account_id,
            token_hash,
            expires_at,
            device_info,
        )
        return RefreshToken.model_validate(dict(record))

    async def get_active_by_hash(self, token_hash: str) -> RefreshToken | None:
        record = await self._conn.fetchrow(
            f"""
            SELECT {_COLUMNS} FROM refresh_tokens
            WHERE token_hash = $1 AND revoked_at IS NULL
            """,
            token_hash,
        )
        return (
            RefreshToken.model_validate(dict(record)) if record is not None else None
        )

    async def revoke(self, token_id: uuid.UUID) -> None:
        await self._conn.execute(
            "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
            token_id,
        )

    async def revoke_all_for_account(self, account_id: uuid.UUID) -> int:
        result = await self._conn.execute(
            """
            UPDATE refresh_tokens SET revoked_at = now()
            WHERE account_id = $1 AND revoked_at IS NULL
            """,
            account_id,
        )
        # asyncpg returns e.g. "UPDATE 3"
        return int(result.split()[-1]) if result else 0
