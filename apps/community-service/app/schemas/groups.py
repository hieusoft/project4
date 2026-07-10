from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import GroupStatus, MemberRole, MemberStatus


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    avatar_url: str | None = Field(default=None, max_length=500)
    cover_url: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=255)
    province_code: str | None = Field(default=None, max_length=10)
    district_code: str | None = Field(default=None, max_length=10)
    allow_member_post: bool = True
    require_post_review: bool = False


class UpdateGroupRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    avatar_url: str | None = Field(default=None, max_length=500)
    cover_url: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=255)
    province_code: str | None = Field(default=None, max_length=10)
    district_code: str | None = Field(default=None, max_length=10)
    allow_member_post: bool | None = None
    require_post_review: bool | None = None


class GroupOut(BaseModel):
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


class MyGroupOut(GroupOut):
    """Group plus the current user's membership on that group."""

    my_role: MemberRole
    my_status: MemberStatus


class JoinGroupRequest(BaseModel):
    message: str | None = Field(default=None, max_length=1000)


class JoinRequestOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    message: str | None = None
    status: MemberStatus
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class MemberOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    role: MemberRole
    status: MemberStatus
    joined_at: datetime | None = None
    created_at: datetime


class UpdateMemberRoleRequest(BaseModel):
    role: MemberRole


class UpdateMemberStatusRequest(BaseModel):
    status: MemberStatus
