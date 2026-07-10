"""Domain models mapped from asyncpg rows."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    ContentStatus,
    GroupStatus,
    MemberRole,
    MemberStatus,
    PostType,
)


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Group(_ORM):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None
    address: str | None = None
    province_code: str | None = None
    district_code: str | None = None
    owner_id: uuid.UUID
    status: GroupStatus
    allow_member_post: bool
    require_post_review: bool
    member_count: int
    reputation_score: int
    created_at: datetime
    updated_at: datetime


class GroupMember(_ORM):
    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    role: MemberRole
    status: MemberStatus
    joined_at: datetime | None = None
    created_at: datetime


class JoinRequest(_ORM):
    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    message: str | None = None
    status: MemberStatus
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class Post(_ORM):
    id: uuid.UUID
    group_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    type: PostType
    ref_id: uuid.UUID | None = None
    status: ContentStatus
    is_pinned: bool
    like_count: int
    comment_count: int
    created_at: datetime
    updated_at: datetime


class PostImage(_ORM):
    id: uuid.UUID
    post_id: uuid.UUID
    image_url: str
    sort_order: int


class PostComment(_ORM):
    id: uuid.UUID
    post_id: uuid.UUID
    author_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    content: str
    status: ContentStatus
    created_at: datetime
