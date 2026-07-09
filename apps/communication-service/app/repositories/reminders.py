from __future__ import annotations

from datetime import datetime
from typing import Any

import asyncpg


class RemindersRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def schedule(
        self,
        *,
        user_id: str,
        ref_type: str,
        ref_id: str,
        remind_at: datetime,
    ) -> dict[str, Any]:
        row = await self._conn.fetchrow(
            """
            INSERT INTO scheduled_reminders (user_id, ref_type, ref_id, remind_at)
            VALUES ($1::uuid, $2, $3::uuid, $4)
            RETURNING id, user_id, ref_type, ref_id, remind_at, sent_at, created_at
            """,
            user_id,
            ref_type,
            ref_id,
            remind_at,
        )
        return dict(row) if row else {}

    async def find_due(self, now: datetime | None = None) -> list[dict[str, Any]]:
        rows = await self._conn.fetch(
            """
            SELECT id, user_id, ref_type, ref_id, remind_at, sent_at, created_at
            FROM scheduled_reminders
            WHERE sent_at IS NULL AND remind_at <= COALESCE($1, now())
            ORDER BY remind_at ASC
            LIMIT 100
            """,
            now,
        )
        return [dict(r) for r in rows]

    async def mark_sent(self, reminder_id: str) -> None:
        await self._conn.execute(
            "UPDATE scheduled_reminders SET sent_at = now() WHERE id = $1::uuid",
            reminder_id,
        )
