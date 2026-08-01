"""Post feed routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUserDep, OptionalUserDep
from app.schemas.common import DataEnvelope, Page, PageMeta
from app.schemas.posts import (
    CommentOut,
    CreateCommentRequest,
    CreatePostRequest,
    FeedPostOut,
    PostOut,
    ReactionOut,
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


@router.get("/feed", response_model=DataEnvelope[Page[FeedPostOut]])
async def list_feed(
    service: PostServiceDep,
    _user: OptionalUserDep = None,
    group_ids: str | None = Query(
        default=None,
        alias="groupIds",
        description="Lọc theo danh sách nhóm, phân tách bằng dấu phẩy",
    ),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    """Feed tổng hợp bài viết công khai từ các hội nhóm đang hoạt động.

    Trả kèm thông tin nhóm (tên, slug, avatar) để client dựng feed mà không
    phải gọi thêm request cho từng bài.
    """
    parsed: list[uuid.UUID] | None = None
    if group_ids is not None:
        parsed = []
        for raw in group_ids.split(","):
            raw = raw.strip()
            if not raw:
                continue
            try:
                parsed.append(uuid.UUID(raw))
            except ValueError:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"groupIds chứa giá trị không hợp lệ: {raw}",
                ) from None

    items, total = await service.list_feed(
        limit=limit, offset=offset, group_ids=parsed
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


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    user: CurrentUserDep,
    service: PostServiceDep,
):
    await service.delete(post_id, user)
    return None


@router.post(
    "/posts/{post_id}/reactions",
    response_model=DataEnvelope[ReactionOut],
)
async def like_post(
    post_id: uuid.UUID, user: CurrentUserDep, service: PostServiceDep
):
    post, changed = await service.like(post_id, user)
    return DataEnvelope(
        data=ReactionOut(
            post_id=post.id,
            liked=True,
            like_count=post.like_count,
            changed=changed,
        )
    )


@router.delete(
    "/posts/{post_id}/reactions",
    response_model=DataEnvelope[ReactionOut],
)
async def unlike_post(
    post_id: uuid.UUID, user: CurrentUserDep, service: PostServiceDep
):
    post, changed = await service.unlike(post_id, user)
    return DataEnvelope(
        data=ReactionOut(
            post_id=post.id,
            liked=False,
            like_count=post.like_count,
            changed=changed,
        )
    )
