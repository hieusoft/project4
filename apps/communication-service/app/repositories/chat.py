from __future__ import annotations

from typing import Any

import asyncpg


class ChatRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def find_or_create_conversation(
        self,
        *,
        type_: str,
        group_id: str,
        user_id: str,
        context_type: str,
        context_id: str,
    ) -> dict[str, Any]:
        existing = await self._conn.fetchrow(
            """
            SELECT id, type, group_id, user_id, context_type, context_id,
                   last_message_at, last_message_preview, created_at
            FROM conversations
            WHERE context_type = $1 AND context_id = $2::uuid
            """,
            context_type,
            context_id,
        )
        if existing:
            return dict(existing)

        row = await self._conn.fetchrow(
            """
            INSERT INTO conversations (type, group_id, user_id, context_type, context_id)
            VALUES ($1::conversation_type, $2::uuid, $3::uuid, $4, $5::uuid)
            ON CONFLICT (context_type, context_id) DO UPDATE
              SET group_id = EXCLUDED.group_id
            RETURNING id, type, group_id, user_id, context_type, context_id,
                      last_message_at, last_message_preview, created_at
            """,
            type_,
            group_id,
            user_id,
            context_type,
            context_id,
        )
        return dict(row) if row else {}

    async def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        row = await self._conn.fetchrow(
            """
            SELECT id, type, group_id, user_id, context_type, context_id,
                   last_message_at, last_message_preview, created_at
            FROM conversations WHERE id = $1::uuid
            """,
            conversation_id,
        )
        return dict(row) if row else None

    async def get_conversation_by_context(
        self, context_type: str, context_id: str
    ) -> dict[str, Any] | None:
        row = await self._conn.fetchrow(
            """
            SELECT id, type, group_id, user_id, context_type, context_id,
                   last_message_at, last_message_preview, created_at
            FROM conversations
            WHERE context_type = $1 AND context_id = $2::uuid
            """,
            context_type,
            context_id,
        )
        return dict(row) if row else None

    async def list_for_user(
        self, user_id: str, group_id: str | None = None
    ) -> list[dict[str, Any]]:
        if group_id:
            rows = await self._conn.fetch(
                """
                SELECT id, type, group_id, user_id, context_type, context_id,
                       last_message_at, last_message_preview, created_at
                FROM conversations
                WHERE group_id = $1::uuid OR user_id = $2::uuid
                ORDER BY last_message_at DESC NULLS LAST, created_at DESC
                """,
                group_id,
                user_id,
            )
        else:
            rows = await self._conn.fetch(
                """
                SELECT id, type, group_id, user_id, context_type, context_id,
                       last_message_at, last_message_preview, created_at
                FROM conversations
                WHERE user_id = $1::uuid
                ORDER BY last_message_at DESC NULLS LAST, created_at DESC
                """,
                user_id,
            )
        return [dict(r) for r in rows]

    async def insert_message(
        self,
        *,
        conversation_id: str,
        sender_id: str,
        sender_side: str,
        type_: str,
        content: str,
    ) -> dict[str, Any]:
        row = await self._conn.fetchrow(
            """
            INSERT INTO messages (conversation_id, sender_id, sender_side, type, content)
            VALUES ($1::uuid, $2::uuid, $3::participant_type, $4::message_type, $5)
            RETURNING id, conversation_id, sender_id, sender_side, type, content,
                      is_hidden, created_at
            """,
            conversation_id,
            sender_id,
            sender_side,
            type_,
            content,
        )
        preview = content[:200]
        await self._conn.execute(
            """
            UPDATE conversations
            SET last_message_at = now(), last_message_preview = $2
            WHERE id = $1::uuid
            """,
            conversation_id,
            preview,
        )
        return dict(row) if row else {}

    async def list_messages(
        self, conversation_id: str, limit: int, offset: int
    ) -> list[dict[str, Any]]:
        rows = await self._conn.fetch(
            """
            SELECT id, conversation_id, sender_id, sender_side, type, content,
                   is_hidden, created_at
            FROM messages
            WHERE conversation_id = $1::uuid AND is_hidden = false
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            conversation_id,
            limit,
            offset,
        )
        return [dict(r) for r in rows]

    async def mark_read(self, conversation_id: str, user_id: str) -> None:
        await self._conn.execute(
            """
            INSERT INTO message_reads (conversation_id, user_id, last_read_at)
            VALUES ($1::uuid, $2::uuid, now())
            ON CONFLICT (conversation_id, user_id)
            DO UPDATE SET last_read_at = now()
            """,
            conversation_id,
            user_id,
        )
