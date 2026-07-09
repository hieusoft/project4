"""Enums mirroring the media_db PostgreSQL enum types."""
from __future__ import annotations

from enum import Enum


class MediaStatus(str, Enum):
    # temp:    uploaded (or presigned) but not attached to any entity yet
    # linked:  attached to a business entity (donation/listing/post/...)
    # deleted: soft-deleted (kept for audit; not currently used by cron which hard-deletes)
    temp = "temp"
    linked = "linked"
    deleted = "deleted"
