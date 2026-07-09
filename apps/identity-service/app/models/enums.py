"""Enum types matching the identity_db native PostgreSQL enums."""
from __future__ import annotations

import enum


class AccountStatus(str, enum.Enum):
    unverified = "unverified"
    active = "active"
    locked = "locked"
    deleted = "deleted"


class OtpPurpose(str, enum.Enum):
    verify_account = "verify_account"
    reset_password = "reset_password"
