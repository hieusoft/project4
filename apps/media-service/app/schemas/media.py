"""Request/response DTOs for the media endpoints.

Allowed mime types and ref_type→folder mapping live here as the single source
of truth, reused by the R2 service for object-key generation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import MediaStatus

# ref_type (purpose) → folder prefix on the R2 bucket.
REF_TYPE_FOLDERS: dict[str, str] = {
    "donation": "donations",
    "listing": "listings",
    "post": "posts",
    "avatar": "avatars",
    "chat": "chat",
    "delivery": "delivery",
}

# Allowed content types → file extension.
MIME_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

RefType = Literal["donation", "listing", "post", "avatar", "chat", "delivery"]
MimeType = Literal["image/jpeg", "image/png", "image/webp"]


class PresignRequest(BaseModel):
    mime_type: MimeType
    ref_type: RefType
    file_size: int = Field(gt=0, description="Size in bytes; validated against max")


class PresignResponse(BaseModel):
    media_id: uuid.UUID
    upload_url: str
    bucket_key: str
    public_url: str
    headers: dict[str, str]
    expires_in: int


class ConfirmRequest(BaseModel):
    media_id: uuid.UUID


class LinkRequest(BaseModel):
    media_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)
    ref_type: RefType
    ref_id: uuid.UUID


class UnlinkRequest(BaseModel):
    media_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)


class MediaOut(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    bucket_key: str
    public_url: str
    mime_type: str
    size_bytes: int
    ref_type: str | None = None
    ref_id: uuid.UUID | None = None
    status: MediaStatus
    created_at: datetime
