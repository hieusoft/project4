"""Service tra ve dung schema — bat loi khi ghep model bi trung khoa.

`FeedPostOut(**PostOut.model_dump(), author=...)` tung no vi PostOut da co
truong `author`; unit test mock repository khong bat duoc loi nay.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.schemas.posts import CommentOut, FeedPostOut, PostAuthorOut, PostOut


def make_post(author_id=None):
    now = datetime.now(timezone.utc)
    return type(
        "Post",
        (),
        {
            "id": uuid.uuid4(),
            "group_id": uuid.uuid4(),
            "author_id": author_id or uuid.uuid4(),
            "content": "Noi dung",
            "type": "normal",
            "ref_id": None,
            "status": "active",
            "is_pinned": False,
            "like_count": 2,
            "comment_count": 1,
            "created_at": now,
            "updated_at": now,
        },
    )()


def make_comment(author_id=None, parent_id=None):
    return type(
        "Comment",
        (),
        {
            "id": uuid.uuid4(),
            "post_id": uuid.uuid4(),
            "author_id": author_id or uuid.uuid4(),
            "parent_id": parent_id,
            "content": "Binh luan",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        },
    )()


def build_service():
    from app.services import posts as module

    service = module.PostService.__new__(module.PostService)
    service._conn = AsyncMock()
    service._posts = AsyncMock()
    service._groups = AsyncMock()
    service._members = AsyncMock()
    service._publisher = AsyncMock()
    return service, module


# ==========================================================================
# PostOut / FeedPostOut
# ==========================================================================
def test_post_out_has_author_field():
    """FeedPostOut ke thua PostOut nen khong duoc khai bao author lan hai."""
    assert "author" in PostOut.model_fields
    assert "author" in FeedPostOut.model_fields


def test_feed_post_out_builds_from_post_out_dump():
    """Tai hien chinh xac cach list_feed ghep model."""
    post = make_post()
    service, _ = build_service()

    base = service._to_out(post, [])
    payload = base.model_dump(exclude={"author"})

    out = FeedPostOut(
        **payload,
        group={
            "id": post.group_id,
            "name": "Nhom A",
            "slug": "nhom-a",
        },
        author=PostAuthorOut(id=post.author_id, full_name="Nguyen Van An"),
        is_liked=True,
        can_interact=True,
    )

    assert out.author is not None
    assert out.author.full_name == "Nguyen Van An"
    assert out.is_liked is True


def test_feed_post_out_rejects_duplicate_author():
    """Quen exclude author -> TypeError; day la loi da xay ra tren production."""
    post = make_post()
    service, _ = build_service()
    base = service._to_out(post, [])

    with pytest.raises(TypeError, match="author"):
        FeedPostOut(
            **base.model_dump(),
            group={"id": post.group_id, "name": "Nhom A", "slug": "nhom-a"},
            author=None,
        )


# ==========================================================================
# author cho bai viet va binh luan
# ==========================================================================
def test_author_out_returns_none_when_profile_missing():
    service, _ = build_service()
    assert service._author_out(uuid.uuid4(), {}) is None


def test_author_out_maps_profile_fields():
    service, _ = build_service()
    uid = uuid.uuid4()
    profiles = {
        str(uid): {
            "full_name": "Tran Thi Binh",
            "username": "tranthibinh",
            "avatar_url": "https://cdn/b.jpg",
        }
    }

    author = service._author_out(uid, profiles)

    assert author.full_name == "Tran Thi Binh"
    assert author.username == "tranthibinh"
    assert author.avatar_url == "https://cdn/b.jpg"


def test_comment_out_carries_author():
    service, _ = build_service()
    uid = uuid.uuid4()
    comment = make_comment(author_id=uid)
    profiles = {str(uid): {"full_name": "Nguyen Van An"}}

    out = service._comment_out(comment, profiles)

    assert isinstance(out, CommentOut)
    assert out.author.full_name == "Nguyen Van An"


def test_comment_out_without_profile_still_renders():
    """Identity chet -> binh luan van hien, chi thieu ten."""
    service, _ = build_service()
    out = service._comment_out(make_comment(), {})

    assert out.author is None
    assert out.content == "Binh luan"


def test_comment_out_keeps_parent_id():
    service, _ = build_service()
    parent = uuid.uuid4()

    out = service._comment_out(make_comment(parent_id=parent), {})

    assert out.parent_id == parent


@pytest.mark.asyncio
async def test_list_comments_loads_authors_in_one_batch(monkeypatch):
    service, module = build_service()
    a1, a2 = uuid.uuid4(), uuid.uuid4()
    comments = [make_comment(author_id=a1), make_comment(author_id=a2)]
    service._posts.get.return_value = make_post()
    service._posts.list_comments.return_value = (comments, 2)

    fetch = AsyncMock(return_value={str(a1): {"full_name": "An"}})
    monkeypatch.setattr(module.identity_client, "get_profiles", fetch)

    out, total = await service.list_comments(uuid.uuid4(), limit=20, offset=0)

    assert total == 2
    fetch.assert_awaited_once()
    assert out[0].author.full_name == "An"
    assert out[1].author is None
