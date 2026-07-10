"""Data access for otp_codes (verification / reset tokens, stored as hashes)."""
from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

from app.models.domain import OtpCode
from app.models.enums import OtpPurpose

_COLUMNS = (
    "id, account_id, code_hash, purpose, attempts, expires_at, used_at, created_at"
)


class OtpRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        account_id: uuid.UUID,
        code_hash: str,
        purpose: OtpPurpose,
        expires_at: datetime,
    ) -> OtpCode:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO otp_codes (account_id, code_hash, purpose, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING {_COLUMNS}
            """,
            account_id,
            code_hash,
            purpose.value,
            expires_at,
        )
        return OtpCode.model_validate(dict(record))

    async def get_active_by_hash(
        self, code_hash: str, purpose: OtpPurpose
    ) -> OtpCode | None:
        record = await self._conn.fetchrow(
            f"""
            SELECT {_COLUMNS} FROM otp_codes
            WHERE code_hash = $1 AND purpose = $2 AND used_at IS NULL
            """,
            code_hash,
            purpose.value,
        )
        return OtpCode.model_validate(dict(record)) if record is not None else None

    async def get_active_for_account(
        self, account_id: uuid.UUID, purpose: OtpPurpose
    ) -> OtpCode | None:
        """Latest unused OTP for this account+purpose (email OTP is looked up by email)."""
        record = await self._conn.fetchrow(
            f"""
            SELECT {_COLUMNS} FROM otp_codes
            WHERE account_id = $1 AND purpose = $2 AND used_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            account_id,
            purpose.value,
        )
        return OtpCode.model_validate(dict(record)) if record is not None else None

    async def bump_attempts(self, otp_id: uuid.UUID) -> None:
        await self._conn.execute(
            """
            UPDATE otp_codes SET attempts = attempts + 1
            WHERE id = $1 AND used_at IS NULL
            """,
            otp_id,
        )

    async def mark_used(self, otp_id: uuid.UUID) -> None:
        await self._conn.execute(
            "UPDATE otp_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL",
            otp_id,
        )

    async def invalidate_active(
        self, account_id: uuid.UUID, purpose: OtpPurpose
    ) -> None:
        """Consume any still-open codes of this purpose before issuing a new one."""
        await self._conn.execute(
            """
            UPDATE otp_codes SET used_at = now()
            WHERE account_id = $1 AND purpose = $2 AND used_at IS NULL
            """,
            account_id,
            purpose.value,
        )
