from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import InventoryStatus, ItemCondition


class InventoryItemOut(BaseModel):
    id: uuid.UUID
    code: str
    group_id: uuid.UUID
    donation_item_id: uuid.UUID | None = None
    donor_id: uuid.UUID | None = None
    name: str
    category_id: uuid.UUID | None = None
    quantity: int
    condition: ItemCondition
    status: InventoryStatus
    note: str | None = None
    imported_at: datetime
    updated_at: datetime


class ItemHistoryOut(BaseModel):
    id: int
    inventory_item_id: uuid.UUID
    from_status: InventoryStatus | None = None
    to_status: InventoryStatus
    actor_id: uuid.UUID | None = None
    ref_type: str | None = None
    ref_id: uuid.UUID | None = None
    note: str | None = None
    created_at: datetime


class UpdateInventoryStatusRequest(BaseModel):
    status: InventoryStatus
    refType: str | None = Field(default=None, max_length=30)
    refId: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=1000)


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    parent_id: uuid.UUID | None = None
    icon_url: str | None = None
    is_active: bool
    sort_order: int
