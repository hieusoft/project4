from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ContentStatus, PostType


class CreatePostRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    type: PostType = PostType.normal
    ref_id: uuid.UUID | None = None
    image_urls: list[str] = Field(default_factory=list, max_length=10)


class UpdatePostRequest(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=10000)
    is_pinned: bool | None = None
    status: ContentStatus | None = None


class PostImageOut(BaseModel):
    id: uuid.UUID
    image_url: str
    sort_order: int


class PostOut(BaseModel):
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
    images: list[PostImageOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CreateCommentRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    parent_id: uuid.UUID | None = None


class CommentOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    author_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    content: str
    status: ContentStatus
    created_at: datetime


class ReactionRequest(BaseModel):
    type: str = Field(default="like", max_length=10)


class ReactionOut(BaseModel):
    """Kết quả like/unlike.

    Trả `like_count` dưới dạng số để client không phải parse chuỗi
    ("liked; like_count=3"). `changed` = False nghĩa là thao tác không đổi gì
    (like lại bài đã like, hoặc unlike bài chưa like).
    """

    post_id: uuid.UUID
    liked: bool
    like_count: int
    changed: bool
