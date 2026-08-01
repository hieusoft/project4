"""Contribution routes. Kong strips /api/donation."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUserDep
from app.models.enums import ContributionStatus
from app.schemas.common import DataEnvelope, Page, PageMeta
from app.schemas.contributions import (
    CheckItemRequest,
    ContributionImageOut,
    ContributionItemOut,
    ContributionOut,
    CreateContributionRequest,
    ReviewContributionRequest,
)
from app.services.providers import ContributionServiceDep

router = APIRouter(tags=["contributions"])


def _image_out(img) -> ContributionImageOut:
    return ContributionImageOut(
        id=img.id,
        contribution_item_id=img.contribution_item_id,
        image_url=img.image_url,
        type=img.type,
    )


def _item_out(item) -> ContributionItemOut:
    return ContributionItemOut(
        id=item.id,
        contribution_id=item.contribution_id,
        campaign_item_id=item.campaign_item_id,
        name=item.name,
        quantity=item.quantity,
        condition_declared=item.condition_declared,
        condition_actual=item.condition_actual,
        check_note=item.check_note,
        checked_by=item.checked_by,
        checked_at=item.checked_at,
        status=item.status,
        reject_reason=item.reject_reason,
        images=[_image_out(i) for i in item.images],
    )


def _contribution_out(c) -> ContributionOut:
    return ContributionOut(
        id=c.id,
        code=c.code,
        campaign_id=c.campaign_id,
        donor_id=c.donor_id,
        status=c.status,
        pickup_method=c.pickup_method,
    pickup_address=c.pickup_address,
    received_at=c.received_at,
        rejected_reason=c.rejected_reason,
        reviewed_by=c.reviewed_by,
        reviewed_at=c.reviewed_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        items=[_item_out(i) for i in c.items],
    )


@router.post(
    "/contributions",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[ContributionOut],
)
async def create_contribution(
    body: CreateContributionRequest,
    user: CurrentUserDep,
    service: ContributionServiceDep,
):
    c = await service.create(user, body)
    return DataEnvelope(data=_contribution_out(c))


@router.get("/contributions", response_model=DataEnvelope[Page[ContributionOut]])
async def list_contributions(
    user: CurrentUserDep,
    service: ContributionServiceDep,
    campaign_id: uuid.UUID | None = None,
    donor_id: uuid.UUID | None = None,
    status_filter: ContributionStatus | None = Query(default=None, alias="status"),
    mine: bool = Query(default=False, description="Only current user's contributions"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list(
        user,
        campaign_id=campaign_id,
        donor_id=donor_id,
        status_filter=status_filter.value if status_filter else None,
        mine=mine,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=Page(
            items=[_contribution_out(c) for c in items],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get("/contributions/{contribution_id}", response_model=DataEnvelope[ContributionOut])
async def get_contribution(
    contribution_id: uuid.UUID,
    user: CurrentUserDep,
    service: ContributionServiceDep,
):
    c = await service.get(contribution_id, user)
    return DataEnvelope(data=_contribution_out(c))


@router.put(
    "/contributions/{contribution_id}/review",
    response_model=DataEnvelope[ContributionOut],
)
async def review_contribution(
    contribution_id: uuid.UUID,
    body: ReviewContributionRequest,
    user: CurrentUserDep,
    service: ContributionServiceDep,
):
    c = await service.review(contribution_id, user, body)
    return DataEnvelope(data=_contribution_out(c))


@router.put(
    "/contributions/{contribution_id}/cancel",
    response_model=DataEnvelope[ContributionOut],
)
async def cancel_contribution(
    contribution_id: uuid.UUID,
    user: CurrentUserDep,
    service: ContributionServiceDep,
):
    c = await service.cancel(contribution_id, user)
    return DataEnvelope(data=_contribution_out(c))


@router.put(
    "/contributions/{contribution_id}/items/{item_id}/check",
    response_model=DataEnvelope[ContributionOut],
)
async def check_item(
    contribution_id: uuid.UUID,
    item_id: uuid.UUID,
    body: CheckItemRequest,
    user: CurrentUserDep,
    service: ContributionServiceDep,
):
    c = await service.check_item(contribution_id, item_id, user, body)
    return DataEnvelope(data=_contribution_out(c))
