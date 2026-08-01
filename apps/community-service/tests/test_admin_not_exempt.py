"""PLATFORM_ADMIN khong duoc mien tru rang buoc thanh vien.

Dang bai / thich / binh luan la hanh vi THAM GIA cong dong: admin muon lam
thi phai vao nhom nhu moi nguoi. Quyen KIEM DUYET (an bai, cam thanh vien,
duyet nhom) van duoc mien tru.
"""
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.core.deps import (
    require_group_member,
    require_group_moderator,
    require_group_owner,
)
from app.models.enums import MemberRole, MemberStatus


class FakeUser:
    def __init__(self, is_admin=False):
        self.uuid = uuid.uuid4()
        self.id = str(self.uuid)
        self.is_admin = is_admin


def patch_members(monkeypatch, member):
    """Gia lap MemberRepository.get tra ve `member`."""
    from app.core import deps as module

    repo = AsyncMock()
    repo.get.return_value = member
    monkeypatch.setattr(module, "MemberRepository", lambda conn: repo)
    return repo


def member(role=MemberRole.member, status=MemberStatus.approved):
    return type("M", (), {"role": role, "status": status})()


# ==========================================================================
# require_group_member: KHONG mien tru admin
# ==========================================================================
@pytest.mark.asyncio
async def test_admin_without_membership_is_rejected(monkeypatch):
    patch_members(monkeypatch, None)

    with pytest.raises(HTTPException) as exc:
        await require_group_member(
            AsyncMock(), group_id=uuid.uuid4(), user=FakeUser(is_admin=True)
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "Group membership required"


@pytest.mark.asyncio
async def test_admin_with_pending_membership_is_rejected(monkeypatch):
    patch_members(monkeypatch, member(status=MemberStatus.pending))

    with pytest.raises(HTTPException):
        await require_group_member(
            AsyncMock(), group_id=uuid.uuid4(), user=FakeUser(is_admin=True)
        )


@pytest.mark.asyncio
async def test_admin_who_joined_is_allowed(monkeypatch):
    patch_members(monkeypatch, member())

    await require_group_member(
        AsyncMock(), group_id=uuid.uuid4(), user=FakeUser(is_admin=True)
    )


@pytest.mark.asyncio
async def test_regular_member_is_allowed(monkeypatch):
    patch_members(monkeypatch, member())

    await require_group_member(
        AsyncMock(), group_id=uuid.uuid4(), user=FakeUser()
    )


@pytest.mark.asyncio
async def test_non_member_is_rejected(monkeypatch):
    patch_members(monkeypatch, None)

    with pytest.raises(HTTPException) as exc:
        await require_group_member(
            AsyncMock(), group_id=uuid.uuid4(), user=FakeUser()
        )
    assert exc.value.status_code == 403


# ==========================================================================
# Quyen KIEM DUYET van mien tru admin
# ==========================================================================
@pytest.mark.asyncio
async def test_admin_still_bypasses_moderator_check(monkeypatch):
    repo = patch_members(monkeypatch, None)

    await require_group_moderator(
        AsyncMock(), group_id=uuid.uuid4(), user=FakeUser(is_admin=True)
    )

    repo.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_admin_still_bypasses_owner_check(monkeypatch):
    repo = patch_members(monkeypatch, None)

    await require_group_owner(
        AsyncMock(), group_id=uuid.uuid4(), user=FakeUser(is_admin=True)
    )

    repo.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_plain_member_cannot_moderate(monkeypatch):
    patch_members(monkeypatch, member(role=MemberRole.member))

    with pytest.raises(HTTPException) as exc:
        await require_group_moderator(
            AsyncMock(), group_id=uuid.uuid4(), user=FakeUser()
        )
    assert exc.value.status_code == 403
