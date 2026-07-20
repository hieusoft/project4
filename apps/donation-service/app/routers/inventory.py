"""Inventory + categories + internal endpoints for Marketplace client."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.core.deps import CurrentUserDep, OptionalUserDep
from app.models.enums import InventoryStatus
from app.schemas.common import DataEnvelope, Page, PageMeta
from app.schemas.inventory import (
    CategoryOut,
    InventoryItemOut,
    ItemHistoryOut,
    UpdateInventoryStatusRequest,
)
from app.services.providers import InventoryServiceDep

router = APIRouter(tags=["inventory"])


def _inv_out(item) -> InventoryItemOut:
    return InventoryItemOut(
        id=item.id,
        code=item.code,
        group_id=item.group_id,
        donation_item_id=item.donation_item_id,
        donor_id=item.donor_id,
        name=item.name,
        category_id=item.category_id,
        quantity=item.quantity,
        condition=item.condition,
        status=item.status,
        note=item.note,
        imported_at=item.imported_at,
        updated_at=item.updated_at,
    )


def _hist_out(h) -> ItemHistoryOut:
    return ItemHistoryOut(
        id=h.id,
        inventory_item_id=h.inventory_item_id,
        from_status=h.from_status,
        to_status=h.to_status,
        actor_id=h.actor_id,
        ref_type=h.ref_type,
        ref_id=h.ref_id,
        note=h.note,
        created_at=h.created_at,
    )


@router.get("/categories", response_model=DataEnvelope[list[CategoryOut]])
async def list_categories(service: InventoryServiceDep):
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


@router.get("/inventory", response_model=DataEnvelope[Page[InventoryItemOut]])
async def list_inventory(
    user: CurrentUserDep,
    service: InventoryServiceDep,
    group_id: uuid.UUID | None = None,
    donor_id: uuid.UUID | None = None,
    status_filter: InventoryStatus | None = Query(default=None, alias="status"),
    mine: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    if mine:
        donor_id = user.uuid
    items, total = await service.list(
        group_id=group_id,
        donor_id=donor_id,
        status_filter=status_filter.value if status_filter else None,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=Page(
            items=[_inv_out(i) for i in items],
            meta=PageMeta(total=total, limit=limit, offset=offset),
        )
    )


@router.get(
    "/inventory/{item_id}",
    response_model=DataEnvelope[InventoryItemOut],
)
async def get_inventory_item(
    item_id: uuid.UUID,
    user: CurrentUserDep,
    service: InventoryServiceDep,
):
    item = await service.get(item_id)
    return DataEnvelope(data=_inv_out(item))


@router.get(
    "/inventory/{item_id}/history",
    response_model=DataEnvelope[list[ItemHistoryOut]],
)
async def inventory_history(
    item_id: uuid.UUID,
    user: CurrentUserDep,
    service: InventoryServiceDep,
):
    hist = await service.history(item_id, user)
    return DataEnvelope(data=[_hist_out(h) for h in hist])


# --- Internal (Marketplace DonationClient) ---


@router.get(
    "/internal/inventory/{item_id}",
    response_model=DataEnvelope[InventoryItemOut],
    tags=["internal"],
)
async def internal_get_inventory(
    item_id: uuid.UUID,
    service: InventoryServiceDep,
    _user: OptionalUserDep = None,
):
    item = await service.get(item_id)
    return DataEnvelope(data=_inv_out(item))


@router.put(
    "/internal/inventory/{item_id}/status",
    response_model=DataEnvelope[InventoryItemOut],
    tags=["internal"],
)
async def internal_update_status(
    item_id: uuid.UUID,
    body: UpdateInventoryStatusRequest,
    service: InventoryServiceDep,
    user: OptionalUserDep = None,
):
    actor = user.uuid if user else None
    item = await service.update_status(item_id, body, actor_id=actor)
    return DataEnvelope(data=_inv_out(item))
