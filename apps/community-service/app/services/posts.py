"""Posts, comments, reactions."""
from __future__ import annotations

import uuid

import asyncpg
from fastapi import HTTPException, status

from app.core.deps import (
    CurrentUser,
    require_group_member,
    require_group_moderator,
)
from app.events import event_names
from app.events.contracts import PostCreatedEvent
from app.events.publisher import EventPublisher
from app.models.domain import Post, PostComment
from app.models.enums import ContentStatus, GroupStatus, MemberRole, MemberStatus
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.posts import PostRepository
from app.schemas.posts import (
    CreateCommentRequest,
    CreatePostRequest,
    PostImageOut,
    PostOut,
    UpdatePostRequest,
)


class PostService:
    def __init__(
        self,
        *,
        conn: asyncpg.Connection,
        publisher: EventPublisher,
    ) -> None:
        self._conn = conn
        self._posts = PostRepository(conn)
        self._groups = GroupRepository(conn)
        self._members = MemberRepository(conn)
        self._publisher = publisher

    async def create(
        self, group_id: uuid.UUID, user: CurrentUser, data: CreatePostRequest
    ) -> PostOut:
        group = await self._groups.get(group_id)
        if group is None or group.status != GroupStatus.active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")

        member = await self._members.get(group_id, user.uuid)
        is_mod = (
            member is not None
            and member.status == MemberStatus.approved
            and member.role in (MemberRole.owner, MemberRole.moderator)
        ) or user.is_admin

        if not user.is_admin:
            if member is None or member.status != MemberStatus.approved:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN, "Group membership required"
                )
            if not group.allow_member_post and not is_mod:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN, "Only moderators can post"
                )

        post_status = ContentStatus.active
        if group.require_post_review and not is_mod:
            post_status = ContentStatus.pending_review

        post, images = await self._posts.create(
            group_id=group_id,
            author_id=user.uuid,
            content=data.content,
            type_=data.type,
            ref_id=data.ref_id,
            status=post_status,
            image_urls=data.image_urls,
        )
        if post_status == ContentStatus.active:
            notify = await self._members.list_moderator_user_ids(group_id)
            await self._publisher.publish(
                event_names.POST_CREATED,
                PostCreatedEvent(
                    postId=str(post.id),
                    groupId=str(group_id),
                    authorId=str(user.uuid),
                    notifyUserIds=notify,
                ),
            )
        return self._to_out(post, images)

    async def get(self, post_id: uuid.UUID, user: CurrentUser | None) -> PostOut:
        post = await self._posts.get(post_id)
        if post is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        if post.status != ContentStatus.active:
            if user is None or (
                not user.is_admin and post.author_id != user.uuid
            ):
                # moderators of group may view
                if user is None:
                    raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
                m = await self._members.get(post.group_id, user.uuid)
                if (
                    m is None
                    or m.status != MemberStatus.approved
                    or m.role not in (MemberRole.owner, MemberRole.moderator)
                ):
                    raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        images = await self._posts.list_images(post_id)
        return self._to_out(post, images)

    async def list_for_group(
        self,
        group_id: uuid.UUID,
        user: CurrentUser | None,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[PostOut], int]:
        group = await self._groups.get(group_id)
        if group is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
        include_hidden = False
        if user and user.is_admin:
            include_hidden = True
        elif user:
            m = await self._members.get(group_id, user.uuid)
            if (
                m
                and m.status == MemberStatus.approved
                and m.role in (MemberRole.owner, MemberRole.moderator)
            ):
                include_hidden = True
        posts, total = await self._posts.list_for_group(
            group_id, limit=limit, offset=offset, include_hidden=include_hidden
        )
        out: list[PostOut] = []
        for p in posts:
            imgs = await self._posts.list_images(p.id)
            out.append(self._to_out(p, imgs))
        return out, total

    async def update(
        self, post_id: uuid.UUID, user: CurrentUser, data: UpdatePostRequest
    ) -> PostOut:
        post = await self._posts.get(post_id)
        if post is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        fields = data.model_dump(exclude_unset=True)
        if "is_pinned" in fields or (
            "status" in fields and fields["status"] != ContentStatus.active
        ):
            await require_group_moderator(
                self._conn, group_id=post.group_id, user=user
            )
        elif post.author_id != user.uuid and not user.is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not post author")
        updated = await self._posts.update(post_id, fields)
        assert updated is not None
        images = await self._posts.list_images(post_id)
        return self._to_out(updated, images)

    async def add_comment(
        self, post_id: uuid.UUID, user: CurrentUser, data: CreateCommentRequest
    ) -> PostComment:
        post = await self._posts.get(post_id)
        if post is None or post.status != ContentStatus.active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        await require_group_member(self._conn, group_id=post.group_id, user=user)
        return await self._posts.add_comment(
            post_id=post_id,
            author_id=user.uuid,
            content=data.content,
            parent_id=data.parent_id,
        )

    async def list_comments(
        self, post_id: uuid.UUID, *, limit: int, offset: int
    ) -> tuple[list[PostComment], int]:
        post = await self._posts.get(post_id)
        if post is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        return await self._posts.list_comments(post_id, limit=limit, offset=offset)

    async def like(self, post_id: uuid.UUID, user: CurrentUser) -> Post:
        post = await self._posts.get(post_id)
        if post is None or post.status != ContentStatus.active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        await require_group_member(self._conn, group_id=post.group_id, user=user)
        await self._posts.add_reaction(
            post_id=post_id, user_id=user.uuid, type_="like"
        )
        updated = await self._posts.get(post_id)
        assert updated is not None
        return updated

    async def unlike(self, post_id: uuid.UUID, user: CurrentUser) -> Post:
        post = await self._posts.get(post_id)
        if post is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
        await require_group_member(self._conn, group_id=post.group_id, user=user)
        await self._posts.remove_reaction(post_id=post_id, user_id=user.uuid)
        updated = await self._posts.get(post_id)
        assert updated is not None
        return updated

    @staticmethod
    def _to_out(post: Post, images) -> PostOut:
        return PostOut(
            id=post.id,
            group_id=post.group_id,
            author_id=post.author_id,
            content=post.content,
            type=post.type,
            ref_id=post.ref_id,
            status=post.status,
            is_pinned=post.is_pinned,
            like_count=post.like_count,
            comment_count=post.comment_count,
            images=[
                PostImageOut(
                    id=i.id, image_url=i.image_url, sort_order=i.sort_order
                )
                for i in images
            ],
            created_at=post.created_at,
            updated_at=post.updated_at,
        )
