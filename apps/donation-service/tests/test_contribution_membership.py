"""Quy tac: chi thanh vien da duyet cua hoi nhom moi duoc quyen gop.

Truoc day bat ky ai co token deu gui duoc don vao dot cua nhom minh khong
tham gia (`create` chi kiem tra campaign active + campaign_item_id hop le).
"""
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.clients.community import CommunityClient


class FakeUser:
    def __init__(self, uid=None, is_admin=False):
        self.uuid = uid or uuid.uuid4()
        self.id = str(self.uuid)
        self.is_admin = is_admin
        self.raw_token = "token"


def make_campaign(group_id=None, *, status="active", item_id=None):
    now = datetime.now(timezone.utc)
    item = type(
        "Item", (), {"id": item_id or uuid.uuid4(), "name": "Ao khoac"}
    )()
    return type(
        "Campaign",
        (),
        {
            "id": uuid.uuid4(),
            "group_id": group_id or uuid.uuid4(),
            "status": status,
            "items": [item],
            "created_at": now,
        },
    )()


def make_request(campaign, *, item_id=None):
    """CreateContributionRequest toi thieu."""
    item = type(
        "ReqItem",
        (),
        {
            "campaign_item_id": item_id or campaign.items[0].id,
            "name": "Ao khoac nam",
            "quantity": 2,
            "condition_declared": type("E", (), {"value": "good"})(),
            "images": [],
        },
    )()
    return type(
        "Req",
        (),
        {
            "campaign_id": campaign.id,
            "pickup_method": type("E", (), {"value": "drop_off"})(),
            "pickup_address": None,
            "items": [item],
        },
    )()


def build_service(campaign):
    from app.services import contributions as module

    service = module.ContributionService.__new__(module.ContributionService)
    service._conn = AsyncMock()
    service._contribs = AsyncMock()
    service._campaigns = AsyncMock()
    service._publisher = AsyncMock()
    service._campaigns.get.return_value = campaign

    created = type("C", (), {"id": uuid.uuid4(), "items": []})()
    service._contribs.create.return_value = created
    service._contribs.add_item.return_value = type("I", (), {"id": uuid.uuid4()})()
    service._contribs.get.return_value = type(
        "C",
        (),
        {
            "id": created.id,
            "code": "CTR-2026-00001",
            "campaign_id": campaign.id,
            "donor_id": uuid.uuid4(),
            "items": [],
        },
    )()
    return service, module


# ==========================================================================
# Chan nguoi ngoai nhom
# ==========================================================================
@pytest.mark.asyncio
async def test_non_member_cannot_contribute(monkeypatch):
    campaign = make_campaign()
    service, module = build_service(campaign)
    monkeypatch.setattr(
        module.community_client, "is_group_member", AsyncMock(return_value=False)
    )

    with pytest.raises(HTTPException) as exc:
        await service.create(FakeUser(), make_request(campaign))

    assert exc.value.status_code == 403
    assert "join this group" in exc.value.detail
    service._contribs.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_approved_member_can_contribute(monkeypatch):
    campaign = make_campaign()
    service, module = build_service(campaign)
    monkeypatch.setattr(
        module.community_client, "is_group_member", AsyncMock(return_value=True)
    )

    await service.create(FakeUser(), make_request(campaign))

    service._contribs.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_platform_admin_bypasses_membership(monkeypatch):
    """Admin ho tro nguoi dung nen khong bi rang buoc thanh vien."""
    campaign = make_campaign()
    service, module = build_service(campaign)
    guard = AsyncMock(return_value=False)
    monkeypatch.setattr(module.community_client, "is_group_member", guard)

    await service.create(FakeUser(is_admin=True), make_request(campaign))

    guard.assert_not_awaited()
    service._contribs.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_membership_checked_before_touching_db(monkeypatch):
    """Khong tao ban ghi nao roi moi kiem tra quyen."""
    campaign = make_campaign()
    service, module = build_service(campaign)
    monkeypatch.setattr(
        module.community_client, "is_group_member", AsyncMock(return_value=False)
    )

    with pytest.raises(HTTPException):
        await service.create(FakeUser(), make_request(campaign))

    service._contribs.create.assert_not_awaited()
    service._contribs.add_item.assert_not_awaited()
    service._publisher.publish.assert_not_awaited()


@pytest.mark.asyncio
async def test_inactive_campaign_rejected_before_membership(monkeypatch):
    """Campaign dong -> 400, khong can goi community."""
    campaign = make_campaign(status="closed")
    service, module = build_service(campaign)
    guard = AsyncMock(return_value=True)
    monkeypatch.setattr(module.community_client, "is_group_member", guard)

    with pytest.raises(HTTPException) as exc:
        await service.create(FakeUser(), make_request(campaign))

    assert exc.value.status_code == 400
    guard.assert_not_awaited()


# ==========================================================================
# CommunityClient.is_group_member
# ==========================================================================
def patch_get_group(monkeypatch, payload):
    client = CommunityClient(base_url="http://community:3002")
    monkeypatch.setattr(client, "get_group", AsyncMock(return_value=payload))
    return client


@pytest.mark.asyncio
async def test_is_group_member_true_for_approved(monkeypatch):
    client = patch_get_group(
        monkeypatch, {"status": "active", "my_status": "approved", "my_role": "member"}
    )
    assert await client.is_group_member(uuid.uuid4(), "tok") is True


@pytest.mark.asyncio
async def test_is_group_member_false_for_pending(monkeypatch):
    """Da xin vao nhom nhung chua duoc duyet -> chua duoc quyen gop."""
    client = patch_get_group(
        monkeypatch, {"status": "active", "my_status": "pending", "my_role": None}
    )
    assert await client.is_group_member(uuid.uuid4(), "tok") is False


@pytest.mark.asyncio
async def test_is_group_member_false_for_banned(monkeypatch):
    client = patch_get_group(
        monkeypatch, {"status": "active", "my_status": "banned", "my_role": "member"}
    )
    assert await client.is_group_member(uuid.uuid4(), "tok") is False


@pytest.mark.asyncio
async def test_is_group_member_false_when_no_membership(monkeypatch):
    client = patch_get_group(
        monkeypatch, {"status": "active", "my_status": None, "my_role": None}
    )
    assert await client.is_group_member(uuid.uuid4(), "tok") is False


@pytest.mark.asyncio
async def test_is_group_member_true_for_owner(monkeypatch):
    """Chu nhom luon duoc coi la thanh vien."""
    client = patch_get_group(
        monkeypatch, {"status": "active", "my_status": None, "my_role": "owner"}
    )
    assert await client.is_group_member(uuid.uuid4(), "tok") is True


@pytest.mark.asyncio
async def test_is_group_member_false_when_group_missing(monkeypatch):
    client = patch_get_group(monkeypatch, None)
    assert await client.is_group_member(uuid.uuid4(), "tok") is False


@pytest.mark.asyncio
async def test_is_group_member_fails_open_when_community_down(monkeypatch):
    """Community sap -> khong chan nghiep vu vi loi ha tang."""
    from app.clients.community import _DEGRADED

    client = patch_get_group(
        monkeypatch, {"status": "active", _DEGRADED: True}
    )
    assert await client.is_group_member(uuid.uuid4(), "tok") is True
