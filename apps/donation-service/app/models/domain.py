from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DonationImage:
    id: uuid.UUID
    donation_item_id: uuid.UUID
    image_url: str
    type: str


@dataclass
class DonationItem:
    id: uuid.UUID
    donation_id: uuid.UUID
    name: str
    category_id: uuid.UUID | None
    quantity: int
    condition_declared: str
    condition_actual: str | None
    check_note: str | None
    checked_by: uuid.UUID | None
    checked_at: datetime | None
    status: str
    reject_reason: str | None
    images: list[DonationImage] = field(default_factory=list)


@dataclass
class Donation:
    id: uuid.UUID
    code: str
    donor_id: uuid.UUID
    group_id: uuid.UUID
    title: str
    description: str | None
    status: str
    pickup_method: str
    pickup_address: str | None
    scheduled_at: datetime | None
    received_at: datetime | None
    rejected_reason: str | None
    reviewed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    items: list[DonationItem] = field(default_factory=list)


@dataclass
class InventoryItem:
    id: uuid.UUID
    code: str
    group_id: uuid.UUID
    donation_item_id: uuid.UUID | None
    donor_id: uuid.UUID | None
    name: str
    category_id: uuid.UUID | None
    quantity: int
    condition: str
    status: str
    note: str | None
    imported_at: datetime
    updated_at: datetime


@dataclass
class ItemStatusHistory:
    id: int
    inventory_item_id: uuid.UUID
    from_status: str | None
    to_status: str
    actor_id: uuid.UUID | None
    ref_type: str | None
    ref_id: uuid.UUID | None
    note: str | None
    created_at: datetime


@dataclass
class Category:
    id: uuid.UUID
    name: str
    slug: str
    parent_id: uuid.UUID | None
    icon_url: str | None
    is_active: bool
    sort_order: int
