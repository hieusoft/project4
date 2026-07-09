"""Data access for media_files (raw asyncpg SQL)."""
from __future__ import annotations

import uuid

import asyncpg

from app.models.domain import MediaFile
from app.models.enums import MediaStatus

_COLUMNS = (
    "id, owner_id, bucket_key, public_url, mime_type, size_bytes, "
    "ref_type, ref_id, status, created_at"
)


def _to_media(record: asyncpg.Record | None) -> MediaFile | None:
    return MediaFile.model_validate(dict(record)) if record is not None else None


class MediaRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create_temp(
        self,
        *,
        owner_id: uuid.UUID,
        bucket_key: str,
        public_url: str,
        mime_type: str,
        size_bytes: int,
        ref_type: str | None,
    ) -> MediaFile:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO media_files
                (owner_id, bucket_key, public_url, mime_type, size_bytes, ref_type, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'temp')
            RETURNING {_COLUMNS}
            """,
            owner_id,
            bucket_key,
            public_url,
            mime_type,
            size_bytes,
            ref_type,
        )
        return _to_media(record)  # type: ignore[return-value]

    async def get_by_id(self, media_id: uuid.UUID) -> MediaFile | None:
        record = await self._conn.fetchrow(
            f"SELECT {_COLUMNS} FROM media_files WHERE id = $1 AND status <> 'deleted'",
            media_id,
        )
        return _to_media(record)

    async def get_many(self, media_ids: list[uuid.UUID]) -> list[MediaFile]:
        rows = await self._conn.fetch(
            f"""
            SELECT {_COLUMNS} FROM media_files
            WHERE id = ANY($1::uuid[]) AND status <> 'deleted'
            """,
            media_ids,
        )
        return [MediaFile.model_validate(dict(r)) for r in rows]

    async def mark_linked(
        self,
        media_id: uuid.UUID,
        *,
        ref_type: str,
        ref_id: uuid.UUID,
    ) -> None:
        await self._conn.execute(
            """
            UPDATE media_files
            SET status = 'linked', ref_type = $2, ref_id = $3
            WHERE id = $1
            """,
            media_id,
            ref_type,
            ref_id,
        )

    async def mark_temp(self, media_id: uuid.UUID) -> None:
        await self._conn.execute(
            """
            UPDATE media_files
            SET status = 'temp', ref_id = NULL
            WHERE id = $1
            """,
            media_id,
        )

    async def find_expired_temp(self, ttl_hours: int) -> list[MediaFile]:
        rows = await self._conn.fetch(
            f"""
            SELECT {_COLUMNS} FROM media_files
            WHERE status = 'temp'
              AND created_at < now() - ($1 || ' hours')::interval
            """,
            str(ttl_hours),
        )
        return [MediaFile.model_validate(dict(r)) for r in rows]

    async def delete_by_id(self, media_id: uuid.UUID) -> None:
        await self._conn.execute(
            "DELETE FROM media_files WHERE id = $1", media_id
        )
