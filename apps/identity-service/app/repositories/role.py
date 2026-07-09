"""Data access for roles and the account_roles join table."""
from __future__ import annotations

import uuid

import asyncpg

from app.models.domain import Role


class RoleRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_by_name(self, name: str) -> Role | None:
        record = await self._conn.fetchrow(
            "SELECT id, name FROM roles WHERE name = $1", name
        )
        return Role.model_validate(dict(record)) if record is not None else None

    async def assign_role(self, account_id: uuid.UUID, role_id: int) -> None:
        await self._conn.execute(
            """
            INSERT INTO account_roles (account_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            """,
            account_id,
            role_id,
        )

    async def assign_role_by_name(
        self, account_id: uuid.UUID, role_name: str
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO account_roles (account_id, role_id)
            SELECT $1, r.id FROM roles r WHERE r.name = $2
            ON CONFLICT DO NOTHING
            """,
            account_id,
            role_name,
        )

    async def get_role_names(self, account_id: uuid.UUID) -> list[str]:
        rows = await self._conn.fetch(
            """
            SELECT r.name
            FROM account_roles ar
            JOIN roles r ON r.id = ar.role_id
            WHERE ar.account_id = $1
            ORDER BY r.id
            """,
            account_id,
        )
        return [r["name"] for r in rows]
