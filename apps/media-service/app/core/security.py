"""JWT verification. Tokens are minted by identity-service; media-service only
verifies them (shared secret + issuer)."""
from __future__ import annotations

from typing import Any

import jwt

from app.core.config import settings

_ALGORITHM = "HS256"


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """Verify signature + issuer + expiry. Raises jwt exceptions on failure."""
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
