from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class Category:
    id: uuid.UUID
    name: str
    slug: str
    parent_id: uuid.UUID | None
    icon_url: str | None
    is_active: bool
    sort_order: int


@dataclass
class CampaignItem:
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    category_id: uuid.UUID | None
    target_quantity: int
    received_quantity: int
    unit: str | None
    condition_required: str | None
    note: str | None


@dataclass
class Campaign:
    id: uuid.UUID
    code: str
    group_id: uuid.UUID
    title: str
    description: str | None
    province_code: str | None
    district_code: str | None
    beneficiary_description: str | None
    status: str
    deadline: date | None
    created_by: uuid.UUID
    fulfilled_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[CampaignItem] = field(default_factory=list)


@dataclass
class ContributionImage:
    id: uuid.UUID
    contribution_item_id: uuid.UUID
    image_url: str
    type: str


@dataclass
class ContributionItem:
    id: uuid.UUID
    contribution_id: uuid.UUID
    campaign_item_id: uuid.UUID
    name: str
    quantity: int
    condition_declared: str
    condition_actual: str | None
    check_note: str | None
    checked_by: uuid.UUID | None
    checked_at: datetime | None
    status: str
    reject_reason: str | None
    images: list[ContributionImage] = field(default_factory=list)


@dataclass
class Contribution:
    id: uuid.UUID
    code: str
    campaign_id: uuid.UUID
    donor_id: uuid.UUID
    status: str
    pickup_method: str
    pickup_address: str | None
    received_at: datetime | None
    rejected_reason: str | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[ContributionItem] = field(default_factory=list)


@dataclass
class CampaignDelivery:
    id: uuid.UUID
    campaign_id: uuid.UUID
    confirmed_by: uuid.UUID
    delivery_photo_url: str | None
    delivery_note: str | None
    delivered_at: datetime
