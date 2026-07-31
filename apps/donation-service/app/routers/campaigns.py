"""Campaign routes. Kong strips /api/donation."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUserDep, OptionalUserDep
from app.models.enums import CampaignStatus
from app.schemas.campaigns import (
    CampaignItemOut,
    CampaignOut,
    CampaignProgressOut,
    CategoryOut,
    CloseCampaignRequest,
    CreateCampaignRequest,
    DeliverCampaignRequest,
    UpdateCampaignRequest,
)
from app.schemas.common import DataEnvelope, Page, PageMeta
from app.services.providers import CampaignServiceDep

router = APIRouter(tags=["campaigns"])


def _item_out(it) -> CampaignItemOut:
    return CampaignItemOut(
        id=it.id,
        campaign_id=it.campaign_id,
        name=it.name,
        category_id=it.category_id,
        target_quantity=it.target_quantity,
        received_quantity=it.received_quantity,
        unit=it.unit,
        condition_required=it.condition_required,
        note=it.note,
    )


def _campaign_out(c) -> CampaignOut:
    return CampaignOut(
        id=c.id,
        code=c.code,
        group_id=c.group_id,
        title=c.title,
        description=c.description,
        province_code=c.province_code,
        district_code=c.district_code,
        beneficiary_description=c.beneficiary_description,
        status=c.status,
        deadline=c.deadline,
        created_by=c.created_by,
        fulfilled_at=c.fulfilled_at,
        closed_at=c.closed_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        items=[_item_out(i) for i in c.items],
    )


@router.post(
    "/campaigns",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[CampaignOut],
)
async def create_campaign(
    body: CreateCampaignRequest,
    user: CurrentUserDep,
    service: CampaignServiceDep,
):
    c = await service.create(user, body)
    return DataEnvelope(data=_campaign_out(c))


@router.get("/campaigns", response_model=DataEnvelope[Page[CampaignOut]])
async def list_campaigns(
    service: CampaignServiceDep,
    _user: OptionalUserDep = None,
    group_id: uuid.UUID | None = None,
    status_filter: CampaignStatus | None = Query(default=None, alias="status"),
    province_code: str | None = Query(default=None, max_length=10),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list(
        group_id=group_id,
        status_filter=status_filter.value if status_filter else None,
        province_code=province_code,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=Page(
            items=[_campaign_out(c) for c in items],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get("/campaigns/{campaign_id}", response_model=DataEnvelope[CampaignOut])
async def get_campaign(
    campaign_id: uuid.UUID,
    service: CampaignServiceDep,
    _user: OptionalUserDep = None,
):
    c = await service.get(campaign_id)
    return DataEnvelope(data=_campaign_out(c))


@router.put("/campaigns/{campaign_id}", response_model=DataEnvelope[CampaignOut])
async def update_campaign(
    campaign_id: uuid.UUID,
    body: UpdateCampaignRequest,
    user: CurrentUserDep,
    service: CampaignServiceDep,
):
    c = await service.update(campaign_id, user, body)
    return DataEnvelope(data=_campaign_out(c))


@router.put("/campaigns/{campaign_id}/close", response_model=DataEnvelope[CampaignOut])
async def close_campaign(
    campaign_id: uuid.UUID,
    body: CloseCampaignRequest,
    user: CurrentUserDep,
    service: CampaignServiceDep,
):
    c = await service.close(campaign_id, user, reason=body.reason)
    return DataEnvelope(data=_campaign_out(c))


@router.post("/campaigns/{campaign_id}/deliver", response_model=DataEnvelope[CampaignOut])
async def deliver_campaign(
    campaign_id: uuid.UUID,
    body: DeliverCampaignRequest,
    user: CurrentUserDep,
    service: CampaignServiceDep,
):
    c = await service.deliver(campaign_id, user, body)
    return DataEnvelope(data=_campaign_out(c))


@router.get(
    "/campaigns/{campaign_id}/progress",
    response_model=DataEnvelope[CampaignProgressOut],
)
async def campaign_progress(
    campaign_id: uuid.UUID,
    service: CampaignServiceDep,
    _user: OptionalUserDep = None,
):
    result = await service.progress(campaign_id)
    return DataEnvelope(data=result)


@router.get("/categories", response_model=DataEnvelope[list[CategoryOut]])
async def list_categories(service: CampaignServiceDep):
    cats = await service.list_categories()
    return DataEnvelope(
        data=[
            CategoryOut(
                id=c.id,
                name=c.name,
                slug=c.slug,
                parent_id=c.parent_id,
                icon_url=c.icon_url,
                is_active=c.is_active,
                sort_order=c.sort_order,
            )
            for c in cats
        ]
    )
