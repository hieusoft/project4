from __future__ import annotations

import uuid
from datetime import datetime, timezone

import asyncpg

from app.models.domain import GroupMember, JoinRequest
from app.models.enums import MemberRole, MemberStatus

_MEMBER_COLS = "id, group_id, user_id, role, status, joined_at, created_at"
_JOIN_COLS = (
    "id, group_id, user_id, message, status, reviewed_by, reviewed_at, created_at"
)


class MemberRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def add(
        self,
        *,
        group_id: uuid.UUID,
        user_id: uuid.UUID,
        role: MemberRole,
        status: MemberStatus,
        joined_at: datetime | None = None,
    ) -> GroupMember:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO group_members (group_id, user_id, role, status, joined_at)
            VALUES ($1, $2, $3::member_role, $4::member_status, $5)
            ON CONFLICT (group_id, user_id) DO UPDATE
              SET role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  joined_at = COALESCE(EXCLUDED.joined_at, group_members.joined_at)
            RETURNING {_MEMBER_COLS}
            """,
            group_id,
            user_id,
            role.value,
            status.value,
            joined_at,
        )
        return GroupMember.model_validate(dict(record))

    async def get(
        self, group_id: uuid.UUID, user_id: uuid.UUID
    ) -> GroupMember | None:
        record = await self._conn.fetchrow(
            f"""
            SELECT {_MEMBER_COLS} FROM group_members
            WHERE group_id = $1 AND user_id = $2
            """,
            group_id,
            user_id,
        )
        return GroupMember.model_validate(dict(record)) if record else None

    async def list_for_group(
        self,
        group_id: uuid.UUID,
        *,
        status: MemberStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[GroupMember], int]:
        if status is not None:
            total = await self._conn.fetchval(
                "SELECT count(*) FROM group_members WHERE group_id=$1 AND status=$2::member_status",
                group_id,
                status.value,
            )
            rows = await self._conn.fetch(
                f"""
                SELECT {_MEMBER_COLS} FROM group_members
                WHERE group_id=$1 AND status=$2::member_status
                ORDER BY created_at ASC
                LIMIT $3 OFFSET $4
                """,
                group_id,
                status.value,
                limit,
                offset,
            )
        else:
            total = await self._conn.fetchval(
                "SELECT count(*) FROM group_members WHERE group_id=$1", group_id
            )
            rows = await self._conn.fetch(
                f"""
                SELECT {_MEMBER_COLS} FROM group_members
                WHERE group_id=$1
                ORDER BY created_at ASC
                LIMIT $2 OFFSET $3
                """,
                group_id,
                limit,
                offset,
            )
        return [GroupMember.model_validate(dict(r)) for r in rows], int(total or 0)

    async def list_moderator_user_ids(self, group_id: uuid.UUID) -> list[str]:
        rows = await self._conn.fetch(
            """
            SELECT user_id FROM group_members
            WHERE group_id = $1 AND status = 'approved'
              AND role IN ('owner', 'moderator')
            """,
            group_id,
        )
        return [str(r["user_id"]) for r in rows]

    async def set_role(
        self, group_id: uuid.UUID, user_id: uuid.UUID, role: MemberRole
    ) -> GroupMember | None:
        record = await self._conn.fetchrow(
            f"""
            UPDATE group_members SET role = $3::member_role
            WHERE group_id = $1 AND user_id = $2 AND status = 'approved'
            RETURNING {_MEMBER_COLS}
            """,
            group_id,
            user_id,
            role.value,
        )
        return GroupMember.model_validate(dict(record)) if record else None

    async def set_status(
        self, group_id: uuid.UUID, user_id: uuid.UUID, status: MemberStatus
    ) -> GroupMember | None:
        joined = (
            datetime.now(timezone.utc) if status == MemberStatus.approved else None
        )
        record = await self._conn.fetchrow(
            f"""
            UPDATE group_members
            SET status = $3::member_status,
                joined_at = CASE
                  WHEN $3::member_status = 'approved' THEN COALESCE(joined_at, $4)
                  ELSE joined_at
                END
            WHERE group_id = $1 AND user_id = $2
            RETURNING {_MEMBER_COLS}
            """,
            group_id,
            user_id,
            status.value,
            joined,
        )
        return GroupMember.model_validate(dict(record)) if record else None

    # --- join requests ---
    async def create_join_request(
        self, *, group_id: uuid.UUID, user_id: uuid.UUID, message: str | None
    ) -> JoinRequest:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO group_join_requests (group_id, user_id, message, status)
            VALUES ($1, $2, $3, 'pending')
            RETURNING {_JOIN_COLS}
            """,
            group_id,
            user_id,
            message,
        )
        return JoinRequest.model_validate(dict(record))

    async def get_join_request(self, request_id: uuid.UUID) -> JoinRequest | None:
        record = await self._conn.fetchrow(
            f"SELECT {_JOIN_COLS} FROM group_join_requests WHERE id = $1", request_id
        )
        return JoinRequest.model_validate(dict(record)) if record else None

    async def list_join_requests(
        self,
        group_id: uuid.UUID,
        *,
        status: MemberStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[JoinRequest], int]:
        if status is not None:
            total = await self._conn.fetchval(
                "SELECT count(*) FROM group_join_requests WHERE group_id=$1 AND status=$2::member_status",
                group_id,
                status.value,
            )
            rows = await self._conn.fetch(
                f"""
                SELECT {_JOIN_COLS} FROM group_join_requests
                WHERE group_id=$1 AND status=$2::member_status
                ORDER BY created_at ASC
                LIMIT $3 OFFSET $4
                """,
                group_id,
                status.value,
                limit,
                offset,
            )
        else:
            total = await self._conn.fetchval(
                "SELECT count(*) FROM group_join_requests WHERE group_id=$1", group_id
            )
            rows = await self._conn.fetch(
                f"""
                SELECT {_JOIN_COLS} FROM group_join_requests
                WHERE group_id=$1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                """,
                group_id,
                limit,
                offset,
            )
        return [JoinRequest.model_validate(dict(r)) for r in rows], int(total or 0)

    async def review_join_request(
        self,
        request_id: uuid.UUID,
        *,
        status: MemberStatus,
        reviewed_by: uuid.UUID,
    ) -> JoinRequest | None:
        record = await self._conn.fetchrow(
            f"""
            UPDATE group_join_requests
            SET status = $2::member_status, reviewed_by = $3, reviewed_at = now()
            WHERE id = $1 AND status = 'pending'
            RETURNING {_JOIN_COLS}
            """,
            request_id,
            status.value,
            reviewed_by,
        )
        return JoinRequest.model_validate(dict(record)) if record else None
