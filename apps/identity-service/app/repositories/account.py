"""Data access for accounts, roles, and the account_roles join table."""
from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

from app.models.domain import Account
from app.models.enums import AccountStatus

_ACCOUNT_COLUMNS = (
    "id, username, email, phone, password_hash, status, email_verified, "
    "totp_secret, totp_enabled, last_login_at, created_at, updated_at"
)


def _to_account(record: asyncpg.Record | None) -> Account | None:
    return Account.model_validate(dict(record)) if record is not None else None


class AccountRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        username: str,
        email: str | None,
        phone: str | None,
        password_hash: str,
    ) -> Account:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO accounts (username, email, phone, password_hash, status)
            VALUES ($1, $2, $3, $4, 'unverified')
            RETURNING {_ACCOUNT_COLUMNS}
            """,
            username,
            email,
            phone,
            password_hash,
        )
        return _to_account(record)  # type: ignore[return-value]

    async def get_by_id(self, account_id: uuid.UUID) -> Account | None:
        record = await self._conn.fetchrow(
            f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE id = $1", account_id
        )
        return _to_account(record)

    async def get_by_email(self, email: str) -> Account | None:
        record = await self._conn.fetchrow(
            f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE email = $1", email
        )
        return _to_account(record)

    async def get_by_phone(self, phone: str) -> Account | None:
        record = await self._conn.fetchrow(
            f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE phone = $1", phone
        )
        return _to_account(record)

    async def get_by_username(self, username: str) -> Account | None:
        record = await self._conn.fetchrow(
            f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE username = $1", username
        )
        return _to_account(record)

    async def set_status(
        self, account_id: uuid.UUID, status: AccountStatus
    ) -> None:
        await self._conn.execute(
            "UPDATE accounts SET status = $2, updated_at = now() WHERE id = $1",
            account_id,
            status.value,
        )

    async def mark_verified(self, account_id: uuid.UUID) -> None:
        await self._conn.execute(
            """
            UPDATE accounts
            SET status = 'active', email_verified = true, updated_at = now()
            WHERE id = $1
            """,
            account_id,
        )

    async def update_password(
        self, account_id: uuid.UUID, password_hash: str
    ) -> None:
        await self._conn.execute(
            "UPDATE accounts SET password_hash = $2, updated_at = now() WHERE id = $1",
            account_id,
            password_hash,
        )

    async def reclaim_unverified(
        self,
        account_id: uuid.UUID,
        *,
        password_hash: str,
        phone: str | None = None,
    ) -> Account | None:
        """Overwrite credentials on an unverified account (email-squatting reclaim).

        Returns None if the row is no longer reclaimable (race: verified meanwhile).
        """
        record = await self._conn.fetchrow(
            f"""
            UPDATE accounts
            SET password_hash = $2,
                phone = COALESCE($3, phone),
                status = 'unverified',
                email_verified = false,
                updated_at = now()
            WHERE id = $1
              AND status = 'unverified'
              AND email_verified = false
            RETURNING {_ACCOUNT_COLUMNS}
            """,
            account_id,
            password_hash,
            phone,
        )
        return _to_account(record)

    async def update_last_login(
        self, account_id: uuid.UUID, when: datetime
    ) -> None:
        await self._conn.execute(
            "UPDATE accounts SET last_login_at = $2, updated_at = now() WHERE id = $1",
            account_id,
            when,
        )

    async def set_totp_secret(
        self, account_id: uuid.UUID, secret: str | None
    ) -> None:
        await self._conn.execute(
            "UPDATE accounts SET totp_secret = $2, updated_at = now() WHERE id = $1",
            account_id,
            secret,
        )

    async def set_totp_enabled(
        self, account_id: uuid.UUID, enabled: bool
    ) -> None:
        await self._conn.execute(
            "UPDATE accounts SET totp_enabled = $2, updated_at = now() WHERE id = $1",
            account_id,
            enabled,
        )

    async def list_accounts(
        self,
        *,
        status: AccountStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Account], int]:
        if status is not None:
            rows = await self._conn.fetch(
                f"""
                SELECT {_ACCOUNT_COLUMNS} FROM accounts
                WHERE status = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                """,
                status.value,
                limit,
                offset,
            )
            total = await self._conn.fetchval(
                "SELECT count(*) FROM accounts WHERE status = $1", status.value
            )
        else:
            rows = await self._conn.fetch(
                f"""
                SELECT {_ACCOUNT_COLUMNS} FROM accounts
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit,
                offset,
            )
            total = await self._conn.fetchval("SELECT count(*) FROM accounts")
        accounts = [Account.model_validate(dict(r)) for r in rows]
        return accounts, int(total or 0)
