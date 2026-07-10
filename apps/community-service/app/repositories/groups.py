from __future__ import annotations

import re
import uuid
from typing import Any

import asyncpg

from app.models.domain import Group
from app.models.enums import GroupStatus

_COLS = (
    "id, name, slug, description, avatar_url, cover_url, address, "
    "province_code, district_code, owner_id, status, allow_member_post, "
    "require_post_review, member_count, reputation_score, created_at, updated_at"
)


def _slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s or "group")[:120]


class GroupRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        name: str,
        owner_id: uuid.UUID,
        description: str | None = None,
        avatar_url: str | None = None,
        cover_url: str | None = None,
        address: str | None = None,
        province_code: str | None = None,
        district_code: str | None = None,
        allow_member_post: bool = True,
        require_post_review: bool = False,
    ) -> Group:
        base = _slugify(name)
        slug = f"{base}-{uuid.uuid4().hex[:8]}"
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO groups (
              name, slug, description, avatar_url, cover_url, address,
              province_code, district_code, owner_id, status,
              allow_member_post, require_post_review, member_count
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,1
            )
            RETURNING {_COLS}
            """,
            name,
            slug,
            description,
            avatar_url,
            cover_url,
            address,
            province_code,
            district_code,
            owner_id,
            allow_member_post,
            require_post_review,
        )
        return Group.model_validate(dict(record))

    async def get(self, group_id: uuid.UUID) -> Group | None:
        record = await self._conn.fetchrow(
            f"SELECT {_COLS} FROM groups WHERE id = $1", group_id
        )
        return Group.model_validate(dict(record)) if record else None

    async def get_by_slug(self, slug: str) -> Group | None:
        record = await self._conn.fetchrow(
            f"SELECT {_COLS} FROM groups WHERE slug = $1", slug
        )
        return Group.model_validate(dict(record)) if record else None

    async def list(
        self,
        *,
        status: GroupStatus | None,
        province_code: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Group], int]:
        clauses: list[str] = []
        args: list[Any] = []
        if status is not None:
            args.append(status.value)
            clauses.append(f"status = ${len(args)}")
        if province_code:
            args.append(province_code)
            clauses.append(f"province_code = ${len(args)}")
        if q:
            args.append(f"%{q}%")
            clauses.append(f"name ILIKE ${len(args)}")
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        total = await self._conn.fetchval(
            f"SELECT count(*) FROM groups {where}", *args
        )
        args.extend([limit, offset])
        rows = await self._conn.fetch(
            f"""
            SELECT {_COLS} FROM groups {where}
            ORDER BY created_at DESC
            LIMIT ${len(args) - 1} OFFSET ${len(args)}
            """,
            *args,
        )
        return [Group.model_validate(dict(r)) for r in rows], int(total or 0)

    async def update(self, group_id: uuid.UUID, fields: dict[str, Any]) -> Group | None:
        if not fields:
            return await self.get(group_id)
        allowed = {
            "name",
            "description",
            "avatar_url",
            "cover_url",
            "address",
            "province_code",
            "district_code",
            "allow_member_post",
            "require_post_review",
            "status",
            "member_count",
            "reputation_score",
        }
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return await self.get(group_id)
        parts: list[str] = []
        values: list[Any] = []
        for i, (col, val) in enumerate(updates.items(), start=2):
            parts.append(f"{col} = ${i}")
            values.append(val.value if hasattr(val, "value") else val)
        set_clause = ", ".join(parts) + ", updated_at = now()"
        record = await self._conn.fetchrow(
            f"""
            UPDATE groups SET {set_clause}
            WHERE id = $1
            RETURNING {_COLS}
            """,
            group_id,
            *values,
        )
        return Group.model_validate(dict(record)) if record else None

    async def bump_member_count(self, group_id: uuid.UUID, delta: int) -> None:
        await self._conn.execute(
            """
            UPDATE groups
            SET member_count = GREATEST(0, member_count + $2), updated_at = now()
            WHERE id = $1
            """,
            group_id,
            delta,
        )
