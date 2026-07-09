"""Password hashing, JWT sign/verify, and token hashing helpers."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_ALGORITHM = "HS256"


# --- Passwords -------------------------------------------------------------
def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


# --- Opaque tokens (refresh / verify / reset) ------------------------------
def generate_token(nbytes: int = 32) -> str:
    """Cryptographically-secure URL-safe token (raw value, shown once)."""
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    """SHA-256 hex digest — only the hash is ever persisted."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# --- JWT -------------------------------------------------------------------
def create_access_token(
    subject: str,
    roles: list[str],
    email: str | None = None,
    expires_in: int | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    ttl = expires_in if expires_in is not None else settings.access_token_ttl_seconds
    payload: dict[str, Any] = {
        "sub": subject,
        "roles": roles,
        "iss": settings.jwt_issuer,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
        "type": "access",
    }
    if email:
        payload["email"] = email
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def create_challenge_token(subject: str) -> str:
    """Short-lived token proving a first-factor login succeeded (pre-2FA)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iss": settings.jwt_issuer,
        "iat": int(now.timestamp()),
        "exp": int(
            (now + timedelta(seconds=settings.two_factor_challenge_ttl_seconds)).timestamp()
        ),
        "type": "2fa_challenge",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


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
