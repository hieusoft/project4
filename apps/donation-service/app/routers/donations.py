"""Donation routes. Kong strips /api/donation."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUserDep
from app.models.enums import DonationStatus
from app.schemas.common import DataEnvelope, Page, PageMeta
from app.schemas.donations import (
    CheckItemRequest,
    CreateDonationRequest,
    DonationItemOut,
    DonationOut,
    DonationImageOut,
    ReviewDonationRequest,
    ScheduleDonationRequest,
    TimelineEntryOut,
)
from app.services.providers import DonationServiceDep

router = APIRouter(tags=["donations"])


def _image_out(img) -> DonationImageOut:
    return DonationImageOut(
        id=img.id,
        donation_item_id=img.donation_item_id,
        image_url=img.image_url,
        type=img.type,
    )


def _item_out(item) -> DonationItemOut:
    return DonationItemOut(
        id=item.id,
        donation_id=item.donation_id,
        name=item.name,
        category_id=item.category_id,
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


def _donation_out(d) -> DonationOut:
    return DonationOut(
        id=d.id,
        code=d.code,
        donor_id=d.donor_id,
        group_id=d.group_id,
        title=d.title,
        description=d.description,
        status=d.status,
        pickup_method=d.pickup_method,
        pickup_address=d.pickup_address,
        scheduled_at=d.scheduled_at,
        received_at=d.received_at,
        rejected_reason=d.rejected_reason,
        reviewed_by=d.reviewed_by,
        created_at=d.created_at,
        updated_at=d.updated_at,
        items=[_item_out(i) for i in d.items],
    )


@router.post(
    "/donations",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[DonationOut],
)
async def create_donation(
    body: CreateDonationRequest,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    d = await service.create(user, body)
    return DataEnvelope(data=_donation_out(d))


@router.get("/donations", response_model=DataEnvelope[Page[DonationOut]])
async def list_donations(
    user: CurrentUserDep,
    service: DonationServiceDep,
    group_id: uuid.UUID | None = None,
    donor_id: uuid.UUID | None = None,
    status_filter: DonationStatus | None = Query(default=None, alias="status"),
    mine: bool = Query(default=False, description="Only current user's donations"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list(
        user,
        group_id=group_id,
        donor_id=donor_id,
        status_filter=status_filter.value if status_filter else None,
        mine=mine,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=Page(
            items=[_donation_out(d) for d in items],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get("/donations/{donation_id}", response_model=DataEnvelope[DonationOut])
async def get_donation(
    donation_id: uuid.UUID,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    d = await service.get(donation_id, user)
    return DataEnvelope(data=_donation_out(d))


@router.put(
    "/donations/{donation_id}/review",
    response_model=DataEnvelope[DonationOut],
)
async def review_donation(
    donation_id: uuid.UUID,
    body: ReviewDonationRequest,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    d = await service.review(donation_id, user, body)
    return DataEnvelope(data=_donation_out(d))


@router.put(
    "/donations/{donation_id}/schedule",
    response_model=DataEnvelope[DonationOut],
)
async def schedule_donation(
    donation_id: uuid.UUID,
    body: ScheduleDonationRequest,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    d = await service.schedule(donation_id, user, body)
    return DataEnvelope(data=_donation_out(d))


@router.put(
    "/donations/{donation_id}/cancel",
    response_model=DataEnvelope[DonationOut],
)
async def cancel_donation(
    donation_id: uuid.UUID,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    d = await service.cancel(donation_id, user)
    return DataEnvelope(data=_donation_out(d))


@router.put(
    "/donations/{donation_id}/items/{item_id}/check",
    response_model=DataEnvelope[DonationOut],
)
async def check_item(
    donation_id: uuid.UUID,
    item_id: uuid.UUID,
    body: CheckItemRequest,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    d = await service.check_item(donation_id, item_id, user, body)
    return DataEnvelope(data=_donation_out(d))


@router.get(
    "/donations/{donation_id}/timeline",
    response_model=DataEnvelope[list[TimelineEntryOut]],
)
async def donation_timeline(
    donation_id: uuid.UUID,
    user: CurrentUserDep,
    service: DonationServiceDep,
):
    entries = await service.timeline(donation_id, user)
    return DataEnvelope(
        data=[TimelineEntryOut(**e) for e in entries]
    )
