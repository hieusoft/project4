"""TOTP-based two-factor setup / enable / disable."""
from __future__ import annotations

import uuid

import pyotp
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.domain import Account
from app.repositories.account import AccountRepository
from app.schemas.two_factor import TwoFactorSetupResponse


class TwoFactorService:
    def __init__(self, accounts: AccountRepository) -> None:
        self._accounts = accounts

    async def setup(self, account: Account) -> TwoFactorSetupResponse:
        """Generate a fresh secret and provisioning URI (not yet enabled)."""
        secret = pyotp.random_base32()
        await self._accounts.set_totp_secret(account.id, secret)
        label = account.email or account.phone or str(account.id)
        otpauth_url = pyotp.TOTP(secret).provisioning_uri(
            name=label, issuer_name=settings.totp_issuer
        )
        return TwoFactorSetupResponse(secret=secret, otpauth_url=otpauth_url)

    async def setup_by_id(self, account_id: uuid.UUID) -> TwoFactorSetupResponse:
        account = await self._require_account(account_id)
        return await self.setup(account)

    async def enable(self, account_id: uuid.UUID, code: str) -> None:
        account = await self._require_account(account_id)
        if not account.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Run 2FA setup first",
            )
        self._verify_code(account.totp_secret, code)
        await self._accounts.set_totp_enabled(account_id, True)

    async def disable(self, account_id: uuid.UUID, code: str) -> None:
        account = await self._require_account(account_id)
        if not account.totp_enabled or not account.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is not enabled",
            )
        self._verify_code(account.totp_secret, code)
        await self._accounts.set_totp_enabled(account_id, False)
        await self._accounts.set_totp_secret(account_id, None)

    async def _require_account(self, account_id: uuid.UUID) -> Account:
        account = await self._accounts.get_by_id(account_id)
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
            )
        return account

    @staticmethod
    def _verify_code(secret: str, code: str) -> None:
        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid 2FA code"
            )
