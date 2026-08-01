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
            VALUES ($1, $2, $3, $4::post_type, $5, $6::content_status)
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

    async def list_images_for(
        self, post_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[PostImage]]:
        """Nạp ảnh của nhiều bài viết trong MỘT query (tránh N+1)."""
        if not post_ids:
            return {}
        rows = await self._conn.fetch(
            f"""
            SELECT {_IMG_COLS} FROM post_images
            WHERE post_id = ANY($1::uuid[])
            ORDER BY post_id, sort_order ASC
            """,
            post_ids,
        )
        grouped: dict[uuid.UUID, list[PostImage]] = {pid: [] for pid in post_ids}
        for r in rows:
            grouped.setdefault(r["post_id"], []).append(
                PostImage.model_validate(dict(r))
            )
        return grouped

    async def list_feed(
        self,
        *,
        limit: int,
        offset: int,
        group_ids: list[uuid.UUID] | None = None,
        viewer_id: uuid.UUID | None = None,
    ) -> tuple[list[tuple[Post, dict[str, Any]]], int]:
        """Feed tổng hợp bài viết từ nhiều hội nhóm, mới nhất trước.

        Chỉ lấy bài `active` thuộc nhóm `active`. Trả kèm thông tin nhóm và
        trạng thái thành viên của người xem để client biết có được phép
        thích/bình luận hay phải mời tham gia nhóm trước.

        Khác `list_for_group`: KHÔNG ưu tiên `is_pinned` — ghim chỉ có ý nghĩa
        trong phạm vi một nhóm, đưa lên feed chung sẽ gây nhiễu.
        """
        where = ["p.status = 'active'", "g.status = 'active'"]
        params: list[Any] = []
        if group_ids is not None:
            if not group_ids:
                return [], 0
            params.append(group_ids)
            where.append(f"p.group_id = ANY(${len(params)}::uuid[])")
        clause = " AND ".join(where)

        total = await self._conn.fetchval(
            f"""
            SELECT count(*) FROM posts p
            JOIN groups g ON g.id = p.group_id
            WHERE {clause}
            """,
            *params,
        )

        # Nạp membership + reaction của chính người xem trong cùng query để
        # client không phải hỏi lại từng nhóm/bài.
        if viewer_id is not None:
            params.append(viewer_id)
            viewer = f"${len(params)}"
            viewer_cols = f"""
              gm.role AS my_role,
              gm.status AS my_status,
              (pr.user_id IS NOT NULL) AS is_liked
            """
            viewer_joins = f"""
            LEFT JOIN group_members gm
              ON gm.group_id = p.group_id AND gm.user_id = {viewer}
            LEFT JOIN post_reactions pr
              ON pr.post_id = p.id AND pr.user_id = {viewer}
            """
        else:
            viewer_cols = """
              NULL::member_role AS my_role,
              NULL::member_status AS my_status,
              false AS is_liked
            """
            viewer_joins = ""

        params.extend([limit, offset])
        rows = await self._conn.fetch(
            f"""
            SELECT
              p.id, p.group_id, p.author_id, p.content, p.type, p.ref_id,
              p.status, p.is_pinned, p.like_count, p.comment_count,
              p.created_at, p.updated_at,
              g.name AS group_name, g.slug AS group_slug,
              g.avatar_url AS group_avatar_url,
              g.owner_id AS group_owner_id,
              {viewer_cols}
            FROM posts p
            JOIN groups g ON g.id = p.group_id
            {viewer_joins}
            WHERE {clause}
            ORDER BY p.created_at DESC
            LIMIT ${len(params) - 1} OFFSET ${len(params)}
            """,
            *params,
        )

        items: list[tuple[Post, dict[str, Any]]] = []
        for r in rows:
            data = dict(r)
            owner_id = data.pop("group_owner_id")
            my_role = data.pop("my_role")
            my_status = data.pop("my_status")
            is_liked = bool(data.pop("is_liked"))
            # Chủ nhóm luôn là thành viên, kể cả khi thiếu bản ghi group_members.
            if viewer_id is not None and owner_id == viewer_id:
                my_role = my_role or "owner"
                my_status = my_status or "approved"
            group = {
                "id": data["group_id"],
                "name": data.pop("group_name"),
                "slug": data.pop("group_slug"),
                "avatar_url": data.pop("group_avatar_url"),
                "my_role": my_role,
                "my_status": my_status,
                # Cờ của bài, gom chung để service không phải trả thêm tuple.
                "_is_liked": is_liked,
            }
            items.append((Post.model_validate(data), group))
        return items, int(total or 0)

    async def update(self, post_id: uuid.UUID, fields: dict[str, Any]) -> Post | None:
        allowed = {"content", "is_pinned", "status"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return await self.get(post_id)
        parts: list[str] = []
        values: list[Any] = []
        for i, (col, val) in enumerate(updates.items(), start=2):
            cast = "::content_status" if col == "status" else ""
            parts.append(f"{col} = ${i}{cast}")
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
