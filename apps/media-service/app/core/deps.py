"""Shared FastAPI dependencies: DB connection, current user, role guard."""
from __future__ import annotations

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


@dataclass
class CurrentUser:
    id: str
    roles: list[str]
    email: str | None = None


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
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]

# Roles allowed to view any media regardless of ownership.
ADMIN_ROLES = ("PLATFORM_ADMIN", "ADMIN")
