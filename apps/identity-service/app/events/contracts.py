"""Event payload contracts — mirror of libs/events/src/contracts/user.events.ts.

Field names use camelCase to match the TypeScript contracts consumed by the
other services (e.g. communication-service). Pydantic models serialize with
these exact keys.
"""
from __future__ import annotations

from pydantic import BaseModel


class UserRegisteredEvent(BaseModel):
    userId: str
    username: str | None = None
    email: str | None = None
    phone: str | None = None
    fullName: str | None = None


class UserVerifiedEvent(BaseModel):
    userId: str


class EmailVerificationRequestedEvent(BaseModel):
    userId: str
    email: str
    code: str  # 6-digit OTP (shown once in email; stored hashed in DB)
    expiresAt: str  # ISO-8601


class EmailVerifiedEvent(BaseModel):
    userId: str
    email: str | None = None


class PasswordResetRequestedEvent(BaseModel):
    userId: str
    email: str
    code: str  # 6-digit OTP (shown once in email; stored hashed in DB)
    expiresAt: str  # ISO-8601


class PasswordResetCompletedEvent(BaseModel):
    userId: str
    email: str | None = None
