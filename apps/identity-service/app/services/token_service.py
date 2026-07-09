"""Issue and rotate access/refresh token pairs."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_token,
    hash_token,
)
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.role import RoleRepository
from app.schemas.token import TokenPair


class TokenService:
    def __init__(
        self,
        refresh_tokens: RefreshTokenRepository,
        roles: RoleRepository,
    ) -> None:
        self._refresh_tokens = refresh_tokens
        self._roles = roles

    async def issue_pair(
        self,
        *,
        account_id: uuid.UUID,
        email: str | None,
        device_info: str | None,
    ) -> TokenPair:
        role_names = await self._roles.get_role_names(account_id)
        access_token = create_access_token(
            subject=str(account_id), roles=role_names, email=email
        )

        raw_refresh = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.refresh_token_ttl_seconds
        )
        await self._refresh_tokens.create(
            account_id=account_id,
            token_hash=hash_token(raw_refresh),
            expires_at=expires_at,
            device_info=device_info,
        )
        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.access_token_ttl_seconds,
        )

    async def rotate(
        self,
        *,
        raw_refresh_token: str,
        email: str | None,
        device_info: str | None,
    ) -> TokenPair | None:
        """Verify + rotate a refresh token. Returns None if invalid/expired."""
        existing = await self._refresh_tokens.get_active_by_hash(
            hash_token(raw_refresh_token)
        )
        if existing is None:
            return None
        expires_at = existing.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return None

        # Rotate: revoke the presented token, issue a fresh pair.
        await self._refresh_tokens.revoke(existing.id)
        return await self.issue_pair(
            account_id=existing.account_id,
            email=email,
            device_info=device_info,
        )
