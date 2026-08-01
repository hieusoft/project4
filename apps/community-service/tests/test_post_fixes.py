"""Regression tests cho community-service.

  BUG-4: thieu DELETE /posts/{id} -> admin-dashboard goi vao se nhan 405.
  BUG-5: like/unlike tra like_count nhung trong CHUOI va khong bao
         duoc thao tac co thay doi gi khong (like lai bai da like).
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.enums import ContentStatus
from app.schemas.posts import ReactionOut


def make_post(*, author_id=None, status=ContentStatus.active, like_count=0):
    now = datetime.now(timezone.utc)
    return type(
        "Post",
        (),
        {
            "id": uuid.uuid4(),
            "group_id": uuid.uuid4(),
            "author_id": author_id or uuid.uuid4(),
            "content": "noi dung",
            "type": "normal",
            "ref_id": None,
            "status": status,
            "is_pinned": False,
            "like_count": like_count,
            "comment_count": 0,
            "created_at": now,
            "updated_at": now,
        },
    )()


class FakeUser:
    def __init__(self, uid=None, is_admin=False):
        self.uuid = uid or uuid.uuid4()
        self.id = str(self.uuid)
        self.is_admin = is_admin


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
# BUG-5: like/unlike
# ==========================================================================
@pytest.mark.asyncio
async def test_like_reports_changed_true_on_first_like(monkeypatch):
    service, module = build_service()
    monkeypatch.setattr(module, "require_group_member", AsyncMock())
    post = make_post()
    service._posts.get.return_value = post
    service._posts.add_reaction.return_value = True

    updated, changed = await service.like(post.id, FakeUser())

    assert changed is True
    assert updated is post


@pytest.mark.asyncio
async def test_like_reports_changed_false_when_already_liked(monkeypatch):
    """Like lai bai da like phai bao changed=False, khong tang so dem."""
    service, module = build_service()
    monkeypatch.setattr(module, "require_group_member", AsyncMock())
    post = make_post(like_count=1)
    service._posts.get.return_value = post
    service._posts.add_reaction.return_value = False

    _, changed = await service.like(post.id, FakeUser())

    assert changed is False


@pytest.mark.asyncio
async def test_unlike_reports_changed_false_when_not_liked(monkeypatch):
    service, module = build_service()
    monkeypatch.setattr(module, "require_group_member", AsyncMock())
    post = make_post()
    service._posts.get.return_value = post
    service._posts.remove_reaction.return_value = False

    _, changed = await service.unlike(post.id, FakeUser())

    assert changed is False


def test_reaction_out_exposes_like_count_as_number():
    """Client khong phai parse chuoi 'liked; like_count=3' nua."""
    out = ReactionOut(
        post_id=uuid.uuid4(), liked=True, like_count=7, changed=True
    )
    assert out.like_count == 7
    assert isinstance(out.like_count, int)
    assert out.liked is True


# ==========================================================================
# BUG-4: DELETE /posts/{id}
# ==========================================================================
@pytest.mark.asyncio
async def test_author_can_delete_own_post(monkeypatch):
    service, module = build_service()
    guard = AsyncMock()
    monkeypatch.setattr(module, "require_group_moderator", guard)
    author = FakeUser()
    post = make_post(author_id=author.uuid)
    service._posts.get.return_value = post

    await service.delete(post.id, author)

    guard.assert_not_awaited()  # tac gia khong can quyen moderator
    service._posts.update.assert_awaited_once()
    assert service._posts.update.await_args.args[1] == {
        "status": ContentStatus.hidden
    }


@pytest.mark.asyncio
async def test_moderator_can_delete_others_post(monkeypatch):
    service, module = build_service()
    guard = AsyncMock()
    monkeypatch.setattr(module, "require_group_moderator", guard)
    post = make_post()
    service._posts.get.return_value = post

    await service.delete(post.id, FakeUser())

    guard.assert_awaited_once()
    service._posts.update.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_missing_post_returns_404(monkeypatch):
    service, module = build_service()
    monkeypatch.setattr(module, "require_group_moderator", AsyncMock())
    service._posts.get.return_value = None

    with pytest.raises(HTTPException) as exc:
        await service.delete(uuid.uuid4(), FakeUser())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_route_is_registered():
    """Chan viec route bi xoa nham -> admin-dashboard se nhan 405."""
    from app.routers import posts as router_module

    routes = {
        (r.path, method)
        for r in router_module.router.routes
        for method in r.methods
    }
    assert ("/posts/{post_id}", "DELETE") in routes
