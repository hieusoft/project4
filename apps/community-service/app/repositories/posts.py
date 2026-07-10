from __future__ import annotations

import uuid
from typing import Any

import asyncpg

from app.models.domain import Post, PostComment, PostImage
from app.models.enums import ContentStatus, PostType

_POST_COLS = (
    "id, group_id, author_id, content, type, ref_id, status, is_pinned, "
    "like_count, comment_count, created_at, updated_at"
)
_IMG_COLS = "id, post_id, image_url, sort_order"
_CMT_COLS = "id, post_id, author_id, parent_id, content, status, created_at"


class PostRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        *,
        group_id: uuid.UUID,
        author_id: uuid.UUID,
        content: str,
        type_: PostType,
        ref_id: uuid.UUID | None,
        status: ContentStatus,
        image_urls: list[str],
    ) -> tuple[Post, list[PostImage]]:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO posts (group_id, author_id, content, type, ref_id, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING {_POST_COLS}
            """,
            group_id,
            author_id,
            content,
            type_.value,
            ref_id,
            status.value,
        )
        post = Post.model_validate(dict(record))
        images: list[PostImage] = []
        for i, url in enumerate(image_urls):
            img = await self._conn.fetchrow(
                f"""
                INSERT INTO post_images (post_id, image_url, sort_order)
                VALUES ($1, $2, $3)
                RETURNING {_IMG_COLS}
                """,
                post.id,
                url,
                i,
            )
            images.append(PostImage.model_validate(dict(img)))
        return post, images

    async def get(self, post_id: uuid.UUID) -> Post | None:
        record = await self._conn.fetchrow(
            f"SELECT {_POST_COLS} FROM posts WHERE id = $1", post_id
        )
        return Post.model_validate(dict(record)) if record else None

    async def list_images(self, post_id: uuid.UUID) -> list[PostImage]:
        rows = await self._conn.fetch(
            f"""
            SELECT {_IMG_COLS} FROM post_images
            WHERE post_id = $1 ORDER BY sort_order ASC
            """,
            post_id,
        )
        return [PostImage.model_validate(dict(r)) for r in rows]

    async def list_for_group(
        self,
        group_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
        include_hidden: bool = False,
    ) -> tuple[list[Post], int]:
        if include_hidden:
            total = await self._conn.fetchval(
                "SELECT count(*) FROM posts WHERE group_id=$1", group_id
            )
            rows = await self._conn.fetch(
                f"""
                SELECT {_POST_COLS} FROM posts
                WHERE group_id=$1
                ORDER BY is_pinned DESC, created_at DESC
                LIMIT $2 OFFSET $3
                """,
                group_id,
                limit,
                offset,
            )
        else:
            total = await self._conn.fetchval(
                "SELECT count(*) FROM posts WHERE group_id=$1 AND status='active'",
                group_id,
            )
            rows = await self._conn.fetch(
                f"""
                SELECT {_POST_COLS} FROM posts
                WHERE group_id=$1 AND status='active'
                ORDER BY is_pinned DESC, created_at DESC
                LIMIT $2 OFFSET $3
                """,
                group_id,
                limit,
                offset,
            )
        return [Post.model_validate(dict(r)) for r in rows], int(total or 0)

    async def update(self, post_id: uuid.UUID, fields: dict[str, Any]) -> Post | None:
        allowed = {"content", "is_pinned", "status"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return await self.get(post_id)
        parts: list[str] = []
        values: list[Any] = []
        for i, (col, val) in enumerate(updates.items(), start=2):
            parts.append(f"{col} = ${i}")
            values.append(val.value if hasattr(val, "value") else val)
        set_clause = ", ".join(parts) + ", updated_at = now()"
        record = await self._conn.fetchrow(
            f"""
            UPDATE posts SET {set_clause}
            WHERE id = $1
            RETURNING {_POST_COLS}
            """,
            post_id,
            *values,
        )
        return Post.model_validate(dict(record)) if record else None

    async def add_comment(
        self,
        *,
        post_id: uuid.UUID,
        author_id: uuid.UUID,
        content: str,
        parent_id: uuid.UUID | None,
    ) -> PostComment:
        record = await self._conn.fetchrow(
            f"""
            INSERT INTO post_comments (post_id, author_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING {_CMT_COLS}
            """,
            post_id,
            author_id,
            content,
            parent_id,
        )
        await self._conn.execute(
            "UPDATE posts SET comment_count = comment_count + 1, updated_at = now() WHERE id = $1",
            post_id,
        )
        return PostComment.model_validate(dict(record))

    async def list_comments(
        self, post_id: uuid.UUID, *, limit: int, offset: int
    ) -> tuple[list[PostComment], int]:
        total = await self._conn.fetchval(
            "SELECT count(*) FROM post_comments WHERE post_id=$1 AND status='active'",
            post_id,
        )
        rows = await self._conn.fetch(
            f"""
            SELECT {_CMT_COLS} FROM post_comments
            WHERE post_id=$1 AND status='active'
            ORDER BY created_at ASC
            LIMIT $2 OFFSET $3
            """,
            post_id,
            limit,
            offset,
        )
        return [PostComment.model_validate(dict(r)) for r in rows], int(total or 0)

    async def add_reaction(
        self, *, post_id: uuid.UUID, user_id: uuid.UUID, type_: str
    ) -> bool:
        """Returns True if newly inserted (not already liked)."""
        result = await self._conn.execute(
            """
            INSERT INTO post_reactions (post_id, user_id, type)
            VALUES ($1, $2, $3)
            ON CONFLICT (post_id, user_id) DO NOTHING
            """,
            post_id,
            user_id,
            type_,
        )
        inserted = result.endswith("1")
        if inserted:
            await self._conn.execute(
                "UPDATE posts SET like_count = like_count + 1, updated_at = now() WHERE id = $1",
                post_id,
            )
        return inserted

    async def remove_reaction(self, *, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM post_reactions WHERE post_id=$1 AND user_id=$2",
            post_id,
            user_id,
        )
        deleted = result.endswith("1")
        if deleted:
            await self._conn.execute(
                """
                UPDATE posts
                SET like_count = GREATEST(0, like_count - 1), updated_at = now()
                WHERE id = $1
                """,
                post_id,
            )
        return deleted
