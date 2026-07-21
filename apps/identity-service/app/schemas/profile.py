"""Profile schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=500)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=10)
    address: str | None = Field(default=None, max_length=255)
    province_code: str | None = Field(default=None, max_length=10)
    district_code: str | None = Field(default=None, max_length=10)
    bio: str | None = None


class ProfilePublic(BaseModel):
    """Public view — no contact/account details."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str
    avatar_url: str | None = None
    province_code: str | None = None
    district_code: str | None = None
    bio: str | None = None
    reputation_score: int
    donation_count: int
    received_count: int
    created_at: datetime


class ProfilePrivate(ProfilePublic):
    """Owner view — adds the personal fields."""

    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None
    updated_at: datetime


class ActivityLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    ref_type: str | None = None
    ref_id: uuid.UUID | None = None
    created_at: datetime
