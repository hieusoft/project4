"""JWT verify (signed by identity-service)."""
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
        options={"require": ["exp", "iss", "sub"]},
    )
    if expected_type is not None and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload
