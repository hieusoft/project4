"""Data access for user_activity_logs."""
from __future__ import annotations

import json
import uuid
from typing import Any

import asyncpg

from app.models.domain import UserActivityLog

_COLUMNS = "id, user_id, action, ref_type, ref_id, metadata, created_at"


def _to_log(record: asyncpg.Record) -> UserActivityLog:
    data = dict(record)
    # asyncpg returns jsonb as a str unless a codec is set; normalize to dict.
    raw = data.get("metadata")
    if isinstance(raw, str):
        data["metadata"] = json.loads(raw)
    return UserActivityLog.model_validate(data)


class ActivityRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def log(
        self,
        *,
        user_id: uuid.UUID,
        action: str,
        ref_type: str | None = None,
        ref_id: uuid.UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO user_activity_logs (user_id, action, ref_type, ref_id, metadata)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            user_id,
            action,
            ref_type,
            ref_id,
            json.dumps(metadata) if metadata is not None else None,
        )

    async def list_for_user(
        self, user_id: uuid.UUID, *, limit: int, offset: int
    ) -> tuple[list[UserActivityLog], int]:
        rows = await self._conn.fetch(
            f"""
            SELECT {_COLUMNS} FROM user_activity_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id,
            limit,
            offset,
        )
        total = await self._conn.fetchval(
            "SELECT count(*) FROM user_activity_logs WHERE user_id = $1", user_id
        )
        return [_to_log(r) for r in rows], int(total or 0)
