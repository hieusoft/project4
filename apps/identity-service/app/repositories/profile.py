"""Data access for user_profiles (shares PK with accounts)."""
from __future__ import annotations

import uuid
from datetime import date

import asyncpg

from app.models.domain import UserProfile

_COLUMNS = (
    "id, full_name, avatar_url, date_of_birth, gender, address, "
    "province_code, district_code, bio, reputation_score, donation_count, "
    "received_count, created_at, updated_at"
)

# Columns a user is allowed to update on their own profile.
_UPDATABLE = (
    "full_name",
    "avatar_url",
    "date_of_birth",
    "gender",
    "address",
    "province_code",
    "district_code",
    "bio",
)


class ProfileRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        account_id: uuid.UUID,
        full_name: str,
    ) -> UserProfile:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO user_profiles (id, full_name)
            VALUES ($1, $2)
            RETURNING {_COLUMNS}
            """,
            account_id,
            full_name,
        )
        return UserProfile.model_validate(dict(record))

    async def get_by_id(self, account_id: uuid.UUID) -> UserProfile | None:
        record = await self._conn.fetchrow(
            f"SELECT {_COLUMNS} FROM user_profiles WHERE id = $1", account_id
        )
        return (
            UserProfile.model_validate(dict(record)) if record is not None else None
        )

    async def get_public_with_username(self, account_id: uuid.UUID) -> dict | None:
        """Fetch profile joined with account username for public view."""
        record = await self._conn.fetchrow(
            """
            SELECT p.id, p.full_name, p.avatar_url, p.date_of_birth, p.gender,
                   p.address, p.province_code, p.district_code, p.bio,
                   p.reputation_score, p.donation_count, p.received_count,
                   p.created_at, p.updated_at, a.username
            FROM user_profiles p
            JOIN accounts a ON a.id = p.id
            WHERE p.id = $1
            """,
            account_id,
        )
        return dict(record) if record is not None else None

    async def get_public_batch_with_username(
        self, account_ids: list[uuid.UUID]
    ) -> list[dict]:
        """Batch fetch profiles joined with account username."""
        if not account_ids:
            return []
        records = await self._conn.fetch(
            """
            SELECT p.id, p.full_name, p.avatar_url, p.date_of_birth, p.gender,
                   p.address, p.province_code, p.district_code, p.bio,
                   p.reputation_score, p.donation_count, p.received_count,
                   p.created_at, p.updated_at, a.username
            FROM user_profiles p
            JOIN accounts a ON a.id = p.id
            WHERE p.id = ANY($1::uuid[])
            """,
            account_ids,
        )
        return [dict(r) for r in records]

    async def update(
        self, account_id: uuid.UUID, fields: dict[str, object]
    ) -> UserProfile | None:
        # Only allow whitelisted columns; build a parametrized SET clause.
        updates = {k: v for k, v in fields.items() if k in _UPDATABLE}
        if not updates:
            return await self.get_by_id(account_id)

        set_parts: list[str] = []
        values: list[object] = []
        for idx, (column, value) in enumerate(updates.items(), start=2):
            set_parts.append(f"{column} = ${idx}")
            values.append(value)
        set_clause = ", ".join(set_parts) + ", updated_at = now()"

        record = await self._conn.fetchrow(
            f"""
            UPDATE user_profiles SET {set_clause}
            WHERE id = $1
            RETURNING {_COLUMNS}
            """,
            account_id,
            *values,
        )
        return (
            UserProfile.model_validate(dict(record)) if record is not None else None
        )

    async def apply_counter_event(
        self,
        *,
        event_type: str,
        aggregate_id: uuid.UUID,
        account_id: uuid.UUID,
        counter: str,
    ) -> bool:
        if counter not in ("donation_count", "received_count"):
            raise ValueError(f"Unsupported profile counter: {counter}")

        inserted = await self._conn.fetchval(
            """
            INSERT INTO profile_counter_events (event_type, aggregate_id, account_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (event_type, aggregate_id) DO NOTHING
            RETURNING true
            """,
            event_type,
            aggregate_id,
            account_id,
        )
        if not inserted:
            return False

        result = await self._conn.execute(
            f"""
            UPDATE user_profiles
            SET {counter} = {counter} + 1, updated_at = now()
            WHERE id = $1
            """,
            account_id,
        )
        if result != "UPDATE 1":
            raise ValueError(f"Profile not found for counter event: {account_id}")
        return True
