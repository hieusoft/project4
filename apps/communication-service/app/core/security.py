"""JWT verify (same secret/issuer as identity-service)."""
from __future__ import annotations

from typing import Any

import jwt

from app.core.config import settings

_ALGORITHM = "HS256"


def decode_token(token: str, expected_type: str | None = "access") -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[_ALGORITHM],
        issuer=settings.jwt_issuer,
        options={"require": ["exp", "sub", "iss"]},
    )
    if expected_type is not None:
        token_type = payload.get("type")
        if token_type is not None and token_type != expected_type:
            raise jwt.InvalidTokenError(f"Expected type={expected_type}")
    return payload
