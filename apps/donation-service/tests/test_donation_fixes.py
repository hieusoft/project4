"""Regression tests cho donation-service.

Bao phu 3 bug da phat hien khi test API that tren server:
  BUG-1: next_code() so sanh MAX(code) theo CHUOI -> sinh ma trung -> 500.
  BUG-2: list() khong tra ve nested items -> client khong chon duoc vat pham.
  BUG-7: GET /contributions khong loc quyen -> lo du lieu nguoi khac.
"""
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import asyncpg
import pytest
from fastapi import HTTPException

from app.repositories.campaigns import CampaignRepository
from app.repositories.contributions import ContributionRepository


# --------------------------------------------------------------------------
# Row builders
# --------------------------------------------------------------------------
def campaign_row(campaign_id: uuid.UUID, *, title: str = "Ao am vung cao") -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": campaign_id,
        "code": "CP-2026-00001",
        "group_id": uuid.uuid4(),
        "title": title,
        "description": None,
        "province_code": None,
        "district_code": None,
        "beneficiary_description": None,
        "status": "active",
        "deadline": date(2026, 12, 31),
        "created_by": uuid.uuid4(),
        "fulfilled_at": None,
        "closed_at": None,
        "created_at": now,
        "updated_at": now,
    }


def campaign_item_row(campaign_id: uuid.UUID, *, name: str) -> dict:
    return {
        "id": uuid.uuid4(),
        "campaign_id": campaign_id,
        "name": name,
        "category_id": None,
        "target_quantity": 10,
        "received_quantity": 4,
        "unit": "cai",
        "condition_required": None,
        "note": None,
    }


def contribution_row(contribution_id: uuid.UUID, *, donor_id=None) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": contribution_id,
        "code": "CTR-2026-00001",
        "campaign_id": uuid.uuid4(),
        "donor_id": donor_id or uuid.uuid4(),
        "status": "pending",
        "pickup_method": "drop_off",
        "pickup_address": None,
        "received_at": None,
        "rejected_reason": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now,
        "updated_at": now,
    }


def contribution_item_row(contribution_id: uuid.UUID, *, name: str) -> dict:
    return {
        "id": uuid.uuid4(),
        "contribution_id": contribution_id,
        "campaign_item_id": uuid.uuid4(),
        "name": name,
        "quantity": 2,
        "condition_declared": "good",
        "condition_actual": None,
        "check_note": None,
        "checked_by": None,
        "checked_at": None,
        "status": "pending",
        "reject_reason": None,
    }


# ==========================================================================
# BUG-1: next_code()
# ==========================================================================
@pytest.mark.asyncio
async def test_campaign_next_code_uses_numeric_max_not_string():
    """SQL phai ep kieu so; du lieu that co ca 'CP-2026-002' lan 'CP-2026-00003'
    nen MAX theo chuoi tra ve '002' -> sinh lai '00003' da ton tai -> 500."""
    conn = AsyncMock()
    conn.fetchval.return_value = 4

    code = await CampaignRepository(conn).next_code()

    assert code == f"CP-{datetime.now(timezone.utc).year}-00004"
    sql = conn.fetchval.await_args.args[0]
    assert "MAX(code)" not in sql, "van con so sanh chuoi"
    assert "bigint" in sql or "::int" in sql, "phai ep kieu so"


@pytest.mark.asyncio
async def test_campaign_next_code_starts_at_one_when_empty():
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    assert (await CampaignRepository(conn).next_code()).endswith("-00001")


@pytest.mark.asyncio
async def test_contribution_next_code_uses_numeric_max():
    conn = AsyncMock()
    conn.fetchval.return_value = 12
    code = await ContributionRepository(conn).next_code()
    assert code == f"CTR-{datetime.now(timezone.utc).year}-00012"
    assert "MAX(code)" not in conn.fetchval.await_args.args[0]


@pytest.mark.asyncio
async def test_campaign_create_retries_on_duplicate_code():
    """Hai request dong thoi co the doc cung so thu tu; UNIQUE chan cai thu hai,
    repository phai sinh lai thay vi tra 500."""
    conn = AsyncMock()
    conn.fetchval.return_value = 3
    created = campaign_row(uuid.uuid4())
    conn.fetchrow.side_effect = [
        asyncpg.UniqueViolationError("duplicate key"),
        created,
    ]

    campaign = await CampaignRepository(conn).create(
        code=None,
        group_id=created["group_id"],
        title="Ao am",
        description=None,
        province_code=None,
        district_code=None,
        beneficiary_description=None,
        deadline=None,
        created_by=created["created_by"],
    )

    assert campaign.id == created["id"]
    assert conn.fetchrow.await_count == 2


@pytest.mark.asyncio
async def test_campaign_create_raises_when_explicit_code_duplicates():
    """Code truyen tay thi khong duoc tu doi -> nem loi de caller biet."""
    conn = AsyncMock()
    conn.fetchrow.side_effect = asyncpg.UniqueViolationError("duplicate key")

    with pytest.raises(asyncpg.UniqueViolationError):
        await CampaignRepository(conn).create(
            code="CP-2026-00001",
            group_id=uuid.uuid4(),
            title="X",
            description=None,
            province_code=None,
            district_code=None,
            beneficiary_description=None,
            deadline=None,
            created_by=uuid.uuid4(),
        )
    assert conn.fetchrow.await_count == 1


@pytest.mark.asyncio
async def test_contribution_create_retries_on_duplicate_code():
    conn = AsyncMock()
    conn.fetchval.return_value = 2
    created = contribution_row(uuid.uuid4())
    conn.fetchrow.side_effect = [
        asyncpg.UniqueViolationError("duplicate key"),
        created,
    ]

    contribution = await ContributionRepository(conn).create(
        code=None,
        campaign_id=created["campaign_id"],
        donor_id=created["donor_id"],
        pickup_method="drop_off",
        pickup_address=None,
    )

    assert contribution.id == created["id"]
    assert conn.fetchrow.await_count == 2


# ==========================================================================
# BUG-2: list() phai tra nested items
# ==========================================================================
@pytest.mark.asyncio
async def test_campaign_list_returns_nested_items():
    campaign_id = uuid.uuid4()
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.side_effect = [
        [campaign_row(campaign_id)],
        [campaign_item_row(campaign_id, name="Ao khoac")],
    ]

    campaigns, total = await CampaignRepository(conn).list()

    assert total == 1
    assert len(campaigns[0].items) == 1
    assert campaigns[0].items[0].name == "Ao khoac"
    assert campaigns[0].items[0].target_quantity == 10


@pytest.mark.asyncio
async def test_campaign_list_groups_items_per_campaign():
    first, second = uuid.uuid4(), uuid.uuid4()
    conn = AsyncMock()
    conn.fetchval.return_value = 2
    conn.fetch.side_effect = [
        [campaign_row(first), campaign_row(second, title="Sach vo")],
        [
            campaign_item_row(first, name="Ao khoac"),
            campaign_item_row(second, name="Vo o ly"),
            campaign_item_row(second, name="But bi"),
        ],
    ]

    campaigns, _ = await CampaignRepository(conn).list()

    by_id = {c.id: c for c in campaigns}
    assert [i.name for i in by_id[first].items] == ["Ao khoac"]
    assert [i.name for i in by_id[second].items] == ["Vo o ly", "But bi"]


@pytest.mark.asyncio
async def test_campaign_list_batches_items_in_one_query():
    """Chan viec tai xuat hien N+1 (1 query moi campaign)."""
    ids = [uuid.uuid4() for _ in range(3)]
    conn = AsyncMock()
    conn.fetchval.return_value = 3
    conn.fetch.side_effect = [
        [campaign_row(cid) for cid in ids],
        [campaign_item_row(cid, name="Item") for cid in ids],
    ]

    await CampaignRepository(conn).list()

    assert conn.fetch.await_count == 2  # 1 campaigns + 1 items, khong phai 1+N


@pytest.mark.asyncio
async def test_campaign_list_handles_campaign_without_items():
    campaign_id = uuid.uuid4()
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.side_effect = [[campaign_row(campaign_id)], []]

    campaigns, _ = await CampaignRepository(conn).list()

    assert campaigns[0].items == []


@pytest.mark.asyncio
async def test_campaign_list_skips_item_query_when_no_rows():
    conn = AsyncMock()
    conn.fetchval.return_value = 0
    conn.fetch.side_effect = [[]]

    campaigns, total = await CampaignRepository(conn).list()

    assert (campaigns, total) == ([], 0)
    assert conn.fetch.await_count == 1


@pytest.mark.asyncio
async def test_contribution_list_returns_nested_items():
    contribution_id = uuid.uuid4()
    conn = AsyncMock()
    conn.fetchval.return_value = 1
    conn.fetch.side_effect = [
        [contribution_row(contribution_id)],
        [contribution_item_row(contribution_id, name="Ao khoac nam")],
        [],  # contribution_images
    ]

    contributions, total = await ContributionRepository(conn).list()

    assert total == 1
    assert len(contributions[0].items) == 1
    assert contributions[0].items[0].name == "Ao khoac nam"


@pytest.mark.asyncio
async def test_contribution_list_skips_item_query_when_no_rows():
    conn = AsyncMock()
    conn.fetchval.return_value = 0
    conn.fetch.side_effect = [[]]

    contributions, _ = await ContributionRepository(conn).list()

    assert contributions == []
    assert conn.fetch.await_count == 1


# ==========================================================================
# BUG-7: loc quyen khi doc contributions
# ==========================================================================
class FakeUser:
    def __init__(self, uid: uuid.UUID, is_admin: bool = False):
        self.uuid = uid
        self.id = str(uid)
        self.is_admin = is_admin
        self.raw_token = "token"


def build_service(*, moderator: bool):
    """ContributionService voi repository/community client gia lap."""
    from app.services import contributions as module

    service = module.ContributionService.__new__(module.ContributionService)
    service._contribs = AsyncMock()
    service._campaigns = AsyncMock()
    service._publisher = AsyncMock()
    service._contribs.list.return_value = ([], 0)
    service._campaigns.get.return_value = type(
        "C", (), {"group_id": uuid.uuid4(), "id": uuid.uuid4()}
    )()
    return service, module


@pytest.mark.asyncio
async def test_list_forces_own_donor_id_for_plain_user(monkeypatch):
    """User thuong khong duoc doc dong gop cua nguoi khac."""
    service, module = build_service(moderator=False)
    me = FakeUser(uuid.uuid4())
    someone_else = uuid.uuid4()

    await service.list(me, donor_id=someone_else)

    assert service._contribs.list.await_args.kwargs["donor_id"] == me.uuid


@pytest.mark.asyncio
async def test_list_allows_admin_to_read_everything():
    service, _ = build_service(moderator=False)
    admin = FakeUser(uuid.uuid4(), is_admin=True)
    target = uuid.uuid4()

    await service.list(admin, donor_id=target)

    assert service._contribs.list.await_args.kwargs["donor_id"] == target


@pytest.mark.asyncio
async def test_list_allows_group_moderator_for_their_campaign(monkeypatch):
    service, module = build_service(moderator=True)
    monkeypatch.setattr(
        module.community_client, "is_group_moderator", AsyncMock(return_value=True)
    )
    moderator = FakeUser(uuid.uuid4())
    campaign_id = uuid.uuid4()

    await service.list(moderator, campaign_id=campaign_id)

    assert service._contribs.list.await_args.kwargs["donor_id"] is None


@pytest.mark.asyncio
async def test_list_blocks_non_moderator_even_with_campaign_id(monkeypatch):
    service, module = build_service(moderator=False)
    monkeypatch.setattr(
        module.community_client, "is_group_moderator", AsyncMock(return_value=False)
    )
    outsider = FakeUser(uuid.uuid4())

    await service.list(outsider, campaign_id=uuid.uuid4())

    assert service._contribs.list.await_args.kwargs["donor_id"] == outsider.uuid


@pytest.mark.asyncio
async def test_get_allows_owner(monkeypatch):
    service, _ = build_service(moderator=False)
    donor = FakeUser(uuid.uuid4())
    contribution = type("X", (), {"donor_id": donor.uuid, "campaign_id": uuid.uuid4()})()
    service._contribs.get.return_value = contribution

    assert await service.get(uuid.uuid4(), donor) is contribution


@pytest.mark.asyncio
async def test_get_rejects_stranger(monkeypatch):
    service, module = build_service(moderator=False)
    monkeypatch.setattr(
        module.community_client, "is_group_moderator", AsyncMock(return_value=False)
    )
    stranger = FakeUser(uuid.uuid4())
    service._contribs.get.return_value = type(
        "X", (), {"donor_id": uuid.uuid4(), "campaign_id": uuid.uuid4()}
    )()

    with pytest.raises(HTTPException) as exc:
        await service.get(uuid.uuid4(), stranger)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_without_user_skips_permission_check():
    """Cac lenh goi noi bo (review/check) tu co _require_moderator rieng."""
    service, _ = build_service(moderator=False)
    contribution = type("X", (), {"donor_id": uuid.uuid4(), "campaign_id": uuid.uuid4()})()
    service._contribs.get.return_value = contribution

    assert await service.get(uuid.uuid4()) is contribution
