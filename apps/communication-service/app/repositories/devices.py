from __future__ import annotations

from typing import Any

import asyncpg


class DevicesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def upsert(self, user_id: str, fcm_token: str, platform: str) -> dict[str, Any]:
        row = await self._conn.fetchrow(
            """
            INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
            VALUES ($1::uuid, $2, $3, now())
            ON CONFLICT (fcm_token) DO UPDATE
              SET user_id = EXCLUDED.user_id,
                  platform = EXCLUDED.platform,
                  updated_at = now()
            RETURNING id, user_id, fcm_token, platform, updated_at
            """,
            user_id,
            fcm_token,
            platform,
        )
        return dict(row) if row else {}

    async def remove(self, user_id: str, fcm_token: str) -> bool:
        result = await self._conn.execute(
            "DELETE FROM device_tokens WHERE user_id = $1::uuid AND fcm_token = $2",
            user_id,
            fcm_token,
        )
        try:
            return int(result.split()[-1]) > 0
        except (ValueError, IndexError):
            return False

    async def tokens_for_users(self, user_ids: list[str]) -> list[str]:
        if not user_ids:
            return []
        rows = await self._conn.fetch(
            "SELECT fcm_token FROM device_tokens WHERE user_id = ANY($1::uuid[])",
            user_ids,
        )
        return [r["fcm_token"] for r in rows]
