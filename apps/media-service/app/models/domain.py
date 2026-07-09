"""Pydantic domain model for the media_files table.

Represents a row returned by the repository layer (mapped from an asyncpg
Record). The database schema is provisioned externally (DDL in docs/database.md).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import MediaStatus


class MediaFile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
