from __future__ import annotations

import uuid
from typing import Any

import asyncpg


class NotificationsRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        user_id: str,
        type_: str,
        title: str,
        body: str | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> dict[str, Any]:
        row = await self._conn.fetchrow(
            """
            INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
            VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid)
            RETURNING id, user_id, type, title, body, ref_type, ref_id, is_read, created_at
            """,
            user_id,
            type_,
            title,
            body,
            ref_type,
            ref_id,
        )
        return dict(row) if row else {}

    async def list_for_user(
        self,
        user_id: str,
        *,
        unread_only: bool,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        if unread_only:
            rows = await self._conn.fetch(
                """
                SELECT id, user_id, type, title, body, ref_type, ref_id, is_read, created_at
                FROM notifications
                WHERE user_id = $1::uuid AND is_read = false
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                """,
                user_id,
                limit,
                offset,
            )
        else:
            rows = await self._conn.fetch(
                """
                SELECT id, user_id, type, title, body, ref_type, ref_id, is_read, created_at
                FROM notifications
                WHERE user_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                """,
                user_id,
                limit,
                offset,
            )
        return [dict(r) for r in rows]

    async def mark_read(self, notification_id: str, user_id: str) -> dict[str, Any] | None:
        row = await self._conn.fetchrow(
            """
            UPDATE notifications SET is_read = true
            WHERE id = $1::uuid AND user_id = $2::uuid
            RETURNING id, user_id, type, title, body, ref_type, ref_id, is_read, created_at
            """,
            notification_id,
            user_id,
        )
        return dict(row) if row else None

    async def mark_all_read(self, user_id: str) -> int:
        result = await self._conn.execute(
            """
            UPDATE notifications SET is_read = true
            WHERE user_id = $1::uuid AND is_read = false
            """,
            user_id,
        )
        # asyncpg returns "UPDATE N"
        try:
            return int(result.split()[-1])
        except (ValueError, IndexError):
            return 0
