"""Pydantic domain models — one per identity_db table.

These represent rows returned by the repository layer (mapped from asyncpg
Records). They are the internal domain representation, distinct from the API
DTOs in app/schemas. The database schema itself is provisioned externally
(DDL lives in docs/database.md).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccountStatus, OtpPurpose


class _ORMModel(BaseModel):
    # from_attributes lets us build models directly from asyncpg Record
    # (via dict(record)) or any attribute-bearing object.
    model_config = ConfigDict(from_attributes=True)


class Account(_ORMModel):
    id: uuid.UUID
    username: str
    email: str | None = None
    phone: str | None = None
    password_hash: str
    status: AccountStatus
    email_verified: bool
    totp_secret: str | None = None
    totp_enabled: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class Role(_ORMModel):
    id: int
    name: str


class RefreshToken(_ORMModel):
    id: uuid.UUID
    account_id: uuid.UUID
    token_hash: str
    device_info: str | None = None
    expires_at: datetime
    revoked_at: datetime | None = None
    created_at: datetime


class OtpCode(_ORMModel):
    id: uuid.UUID
    account_id: uuid.UUID
    code_hash: str
    purpose: OtpPurpose
    attempts: int
    expires_at: datetime
    used_at: datetime | None = None
    created_at: datetime


class UserProfile(_ORMModel):
    id: uuid.UUID  # == accounts.id (shared PK)
    full_name: str
    avatar_url: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None
    province_code: str | None = None
    district_code: str | None = None
    bio: str | None = None
    reputation_score: int
    donation_count: int
    received_count: int
    created_at: datetime
    updated_at: datetime


class UserActivityLog(_ORMModel):
    id: int
    user_id: uuid.UUID
    action: str
    ref_type: str | None = None
    ref_id: uuid.UUID | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime
