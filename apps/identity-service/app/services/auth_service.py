"""Authentication flows: register, verify email, login, 2FA, password reset.

Orchestrates repositories + token service + event publisher. All DB work runs
on the single request-scoped asyncpg connection/transaction (see deps.get_db),
so a failure rolls the whole operation back.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pyotp
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import (
    create_challenge_token,
    decode_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.events.contracts import (
    EmailVerificationRequestedEvent,
    EmailVerifiedEvent,
    PasswordResetCompletedEvent,
    PasswordResetRequestedEvent,
    UserRegisteredEvent,
    UserVerifiedEvent,
)
from app.events import event_names
from app.events.publisher import EventPublisher
from app.models.domain import Account
from app.models.enums import AccountStatus, OtpPurpose
from app.repositories.account import AccountRepository
from app.repositories.activity import ActivityRepository
from app.repositories.otp import OtpRepository
from app.repositories.profile import ProfileRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.role import RoleRepository
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.schemas.token import TokenPair, TwoFactorChallenge
from app.services.token_service import TokenService

_DEFAULT_ROLE = "USER"


class AuthService:
    def __init__(
        self,
        *,
        accounts: AccountRepository,
        roles: RoleRepository,
        otps: OtpRepository,
        profiles: ProfileRepository,
        activity: ActivityRepository,
        refresh_tokens: RefreshTokenRepository,
        tokens: TokenService,
        publisher: EventPublisher,
    ) -> None:
        self._accounts = accounts
        self._roles = roles
        self._otps = otps
        self._profiles = profiles
        self._activity = activity
        self._refresh_tokens = refresh_tokens
        self._tokens = tokens
        self._publisher = publisher

    # --- Registration -----------------------------------------------------
    async def register(self, data: RegisterRequest) -> Account:
        if data.email and await self._accounts.get_by_email(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already in use"
            )
        if data.phone and await self._accounts.get_by_phone(data.phone):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Phone already in use"
            )

        account = await self._accounts.create(
            email=data.email,
            phone=data.phone,
            password_hash=hash_password(data.password),
        )
        await self._roles.assign_role_by_name(account.id, _DEFAULT_ROLE)
        await self._profiles.create(account_id=account.id, full_name=data.full_name)

        # user.registered — general "an account now exists" signal
        await self._publisher.publish(
            event_names.USER_REGISTERED,
            UserRegisteredEvent(
                userId=str(account.id),
                email=account.email,
                phone=account.phone,
                fullName=data.full_name,
            ),
        )

        if account.email:
            await self._issue_email_verification(account)
        return account

    async def _issue_email_verification(self, account: Account) -> str:
        raw_token = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.email_verification_expiry_hours
        )
        await self._otps.invalidate_active(account.id, OtpPurpose.verify_account)
        await self._otps.create(
            account_id=account.id,
            code_hash=hash_token(raw_token),
            purpose=OtpPurpose.verify_account,
            expires_at=expires_at,
        )
        await self._publisher.publish(
            event_names.EMAIL_VERIFICATION_REQUESTED,
            EmailVerificationRequestedEvent(
                userId=str(account.id),
                email=account.email or "",
                token=raw_token,
                expiresAt=expires_at.isoformat(),
            ),
        )
        return raw_token

    async def resend_verification(self, email: str) -> None:
        account = await self._accounts.get_by_email(email)
        # Do not leak whether the email exists / is already verified.
        if account is None or account.email_verified:
            return
        await self._issue_email_verification(account)

    async def verify_email(self, raw_token: str) -> Account:
        otp = await self._otps.get_active_by_hash(
            hash_token(raw_token), OtpPurpose.verify_account
        )
        if otp is None or self._is_expired(otp.expires_at):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token",
            )
        await self._otps.mark_used(otp.id)
        await self._accounts.mark_verified(otp.account_id)

        account = await self._accounts.get_by_id(otp.account_id)
        assert account is not None
        await self._publisher.publish(
            event_names.EMAIL_VERIFIED,
            EmailVerifiedEvent(userId=str(account.id), email=account.email),
        )
        await self._publisher.publish(
            event_names.USER_VERIFIED, UserVerifiedEvent(userId=str(account.id))
        )
        return account

    # --- Login ------------------------------------------------------------
    async def login(
        self, data: LoginRequest
    ) -> TokenPair | TwoFactorChallenge:
        account = await self._resolve_login_account(data)
        if account is None or not verify_password(
            data.password, account.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        self._assert_account_usable(account)

        if account.totp_enabled:
            return TwoFactorChallenge(
                challenge_token=create_challenge_token(str(account.id))
            )
        return await self._complete_login(account, data.device_info)

    async def login_two_factor(
        self, *, challenge_token: str, code: str, device_info: str | None
    ) -> TokenPair:
        try:
            payload = decode_token(challenge_token, expected_type="2fa_challenge")
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired challenge",
            )
        account = await self._accounts.get_by_id(uuid.UUID(str(payload["sub"])))
        if account is None or not account.totp_enabled or not account.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="2FA not available"
            )
        self._assert_account_usable(account)
        if not pyotp.TOTP(account.totp_secret).verify(code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code"
            )
        return await self._complete_login(account, device_info)

    async def _complete_login(
        self, account: Account, device_info: str | None
    ) -> TokenPair:
        now = datetime.now(timezone.utc)
        await self._accounts.update_last_login(account.id, now)
        await self._activity.log(user_id=account.id, action="login")
        return await self._tokens.issue_pair(
            account_id=account.id,
            email=account.email,
            device_info=device_info,
        )

    # --- Refresh / logout -------------------------------------------------
    async def refresh(
        self, *, raw_refresh_token: str, device_info: str | None
    ) -> TokenPair:
        pair = await self._tokens.rotate(
            raw_refresh_token=raw_refresh_token,
            email=None,
            device_info=device_info,
        )
        if pair is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        return pair

    async def logout(self, raw_refresh_token: str) -> None:
        existing = await self._refresh_tokens.get_active_by_hash(
            hash_token(raw_refresh_token)
        )
        if existing is not None:
            await self._refresh_tokens.revoke(existing.id)

    # --- Password reset ---------------------------------------------------
    async def forgot_password(self, email: str) -> None:
        account = await self._accounts.get_by_email(email)
        if account is None:
            return  # do not leak account existence
        raw_token = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.password_reset_expiry_hours
        )
        await self._otps.invalidate_active(account.id, OtpPurpose.reset_password)
        await self._otps.create(
            account_id=account.id,
            code_hash=hash_token(raw_token),
            purpose=OtpPurpose.reset_password,
            expires_at=expires_at,
        )
        await self._publisher.publish(
            event_names.PASSWORD_RESET_REQUESTED,
            PasswordResetRequestedEvent(
                userId=str(account.id),
                email=account.email or "",
                token=raw_token,
                expiresAt=expires_at.isoformat(),
            ),
        )

    async def reset_password(self, data: ResetPasswordRequest) -> None:
        otp = await self._otps.get_active_by_hash(
            hash_token(data.token), OtpPurpose.reset_password
        )
        if otp is None or self._is_expired(otp.expires_at):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )
        await self._otps.mark_used(otp.id)
        await self._accounts.update_password(
            otp.account_id, hash_password(data.new_password)
        )
        # Revoke every session after a password change.
        await self._refresh_tokens.revoke_all_for_account(otp.account_id)

        account = await self._accounts.get_by_id(otp.account_id)
        await self._publisher.publish(
            event_names.PASSWORD_RESET_COMPLETED,
            PasswordResetCompletedEvent(
                userId=str(otp.account_id),
                email=account.email if account else None,
            ),
        )

    # --- Helpers ----------------------------------------------------------
    async def _resolve_login_account(self, data: LoginRequest) -> Account | None:
        if data.email:
            return await self._accounts.get_by_email(data.email)
        if data.phone:
            return await self._accounts.get_by_phone(data.phone)
        return None

    def _assert_account_usable(self, account: Account) -> None:
        if account.status == AccountStatus.locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Account is locked"
            )
        if account.status == AccountStatus.deleted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Account not available"
            )
        if account.status == AccountStatus.unverified or not account.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account not verified",
            )

    @staticmethod
    def _is_expired(when: datetime) -> bool:
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return when <= datetime.now(timezone.utc)
