"""Post feed routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUserDep, OptionalUserDep
from app.schemas.common import DataEnvelope, MessageResponse, Page, PageMeta
from app.schemas.posts import (
    CommentOut,
    CreateCommentRequest,
    CreatePostRequest,
    PostOut,
    UpdatePostRequest,
)
from app.services.providers import PostServiceDep

router = APIRouter(tags=["posts"])


@router.post(
    "/groups/{group_id}/posts",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[PostOut],
)
async def create_post(
    group_id: uuid.UUID,
    body: CreatePostRequest,
    user: CurrentUserDep,
    service: PostServiceDep,
):
    post = await service.create(group_id, user, body)
    return DataEnvelope(data=post)


@router.get(
    "/groups/{group_id}/posts",
    response_model=DataEnvelope[Page[PostOut]],
)
async def list_posts(
    group_id: uuid.UUID,
    service: PostServiceDep,
    user: OptionalUserDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list_for_group(
        group_id, user, limit=limit, offset=offset
    )
    return DataEnvelope(
        data=Page(
            items=items,
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get("/posts/{post_id}", response_model=DataEnvelope[PostOut])
async def get_post(
    post_id: uuid.UUID, service: PostServiceDep, user: OptionalUserDep
):
    post = await service.get(post_id, user)
    return DataEnvelope(data=post)


@router.patch("/posts/{post_id}", response_model=DataEnvelope[PostOut])
async def update_post(
    post_id: uuid.UUID,
    body: UpdatePostRequest,
    user: CurrentUserDep,
    service: PostServiceDep,
):
    post = await service.update(post_id, user, body)
    return DataEnvelope(data=post)


@router.post(
    "/posts/{post_id}/comments",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[CommentOut],
)
async def add_comment(
    post_id: uuid.UUID,
    body: CreateCommentRequest,
    user: CurrentUserDep,
    service: PostServiceDep,
):
    c = await service.add_comment(post_id, user, body)
    return DataEnvelope(data=CommentOut.model_validate(c, from_attributes=True))


@router.get(
    "/posts/{post_id}/comments",
    response_model=DataEnvelope[Page[CommentOut]],
)
async def list_comments(
    post_id: uuid.UUID,
    service: PostServiceDep,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list_comments(post_id, limit=limit, offset=offset)
    return DataEnvelope(
        data=Page(
            items=[
                CommentOut.model_validate(i, from_attributes=True) for i in items
            ],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.post(
    "/posts/{post_id}/reactions",
    response_model=DataEnvelope[MessageResponse],
)
async def like_post(
    post_id: uuid.UUID, user: CurrentUserDep, service: PostServiceDep
):
    post = await service.like(post_id, user)
    return DataEnvelope(
        data=MessageResponse(message=f"liked; like_count={post.like_count}")
    )


@router.delete(
    "/posts/{post_id}/reactions",
    response_model=DataEnvelope[MessageResponse],
)
async def unlike_post(
    post_id: uuid.UUID, user: CurrentUserDep, service: PostServiceDep
):
    post = await service.unlike(post_id, user)
    return DataEnvelope(
        data=MessageResponse(message=f"unliked; like_count={post.like_count}")
    )
