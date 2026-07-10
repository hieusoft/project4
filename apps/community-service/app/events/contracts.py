"""Event payloads (camelCase for cross-service contracts)."""
from __future__ import annotations

from pydantic import BaseModel


class GroupCreatedEvent(BaseModel):
    groupId: str
    ownerId: str
    name: str | None = None


class GroupApprovedEvent(BaseModel):
    groupId: str
    ownerId: str
    name: str | None = None


class GroupJoinRequestedEvent(BaseModel):
    groupId: str
    userId: str
    notifyUserIds: list[str] | None = None


class GroupMemberApprovedEvent(BaseModel):
    groupId: str
    userId: str


class PostCreatedEvent(BaseModel):
    postId: str
    groupId: str
    authorId: str
    notifyUserIds: list[str] | None = None
