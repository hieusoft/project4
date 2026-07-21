"""Account (admin) schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccountStatus


class AccountSummary(BaseModel):
    """Admin-facing account view. Sensitive columns are never included."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str | None = None
    phone: str | None = None
    status: AccountStatus
    email_verified: bool
    totp_enabled: bool
    last_login_at: datetime | None = None
    created_at: datetime


class MeResponse(BaseModel):
    """Current authenticated identity (from /auth flows and token)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str | None = None
    phone: str | None = None
    status: AccountStatus
    email_verified: bool
    totp_enabled: bool
    roles: list[str] = []
