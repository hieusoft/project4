"""Admin account management: list, lock, unlock."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from app.models.domain import Account
from app.models.enums import AccountStatus
from app.repositories.account import AccountRepository
from app.repositories.refresh_token import RefreshTokenRepository


class AccountService:
    def __init__(
        self,
        accounts: AccountRepository,
        refresh_tokens: RefreshTokenRepository,
    ) -> None:
        self._accounts = accounts
        self._refresh_tokens = refresh_tokens

    async def get(self, account_id: uuid.UUID) -> Account:
        account = await self._accounts.get_by_id(account_id)
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
            )
        return account

    async def list_accounts(
        self, *, status_filter: AccountStatus | None, limit: int, offset: int
    ) -> tuple[list[Account], int]:
        return await self._accounts.list_accounts(
            status=status_filter, limit=limit, offset=offset
        )

    async def lock(self, account_id: uuid.UUID) -> Account:
        account = await self.get(account_id)
        await self._accounts.set_status(account.id, AccountStatus.locked)
        # Locking invalidates every active session.
        await self._refresh_tokens.revoke_all_for_account(account.id)
        return await self.get(account_id)

    async def unlock(self, account_id: uuid.UUID) -> Account:
        account = await self.get(account_id)
        if account.status != AccountStatus.locked:
            return account
        # Restore to active (only makes sense for a previously-verified account).
        await self._accounts.set_status(account.id, AccountStatus.active)
        return await self.get(account_id)
