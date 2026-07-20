"""FastAPI dependencies: DB, current user."""
from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Annotated

import asyncpg
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import get_connection
from app.core.security import decode_token

_bearer = HTTPBearer(auto_error=False)

ADMIN_ROLES = ("PLATFORM_ADMIN", "ADMIN")


@dataclass
class CurrentUser:
    id: str
    roles: list[str]
    email: str | None = None
    raw_token: str | None = None

    @property
    def uuid(self) -> uuid.UUID:
        return uuid.UUID(self.id)

    @property
    def is_admin(self) -> bool:
        return any(r in ADMIN_ROLES for r in self.roles)


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    async for connection in get_connection():
        yield connection


DbConn = Annotated[asyncpg.Connection, Depends(get_db)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    subject = str(payload.get("sub") or "")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject",
        )
    roles = payload.get("roles") or []
    email = payload.get("email")
    return CurrentUser(
        id=subject,
        roles=[str(r) for r in roles],
        email=email if isinstance(email, str) else None,
        raw_token=credentials.credentials,
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


OptionalUserDep = Annotated[CurrentUser | None, Depends(get_optional_user)]
