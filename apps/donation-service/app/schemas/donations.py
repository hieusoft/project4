from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import (
    DonationItemStatus,
    DonationStatus,
    ImageType,
    ItemCondition,
    PickupMethod,
)


class DonationImageIn(BaseModel):
    image_url: str = Field(min_length=1, max_length=500)
    type: ImageType = ImageType.declared


class DonationItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category_id: uuid.UUID | None = None
    quantity: int = Field(default=1, ge=1)
    condition_declared: ItemCondition
    images: list[DonationImageIn] = Field(default_factory=list)


class CreateDonationRequest(BaseModel):
    group_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    pickup_method: PickupMethod = PickupMethod.drop_off
    pickup_address: str | None = Field(default=None, max_length=255)
    items: list[DonationItemIn] = Field(min_length=1)


class ReviewDonationRequest(BaseModel):
    action: str = Field(pattern="^(accepted|rejected)$")
    reason: str | None = Field(default=None, max_length=1000)


class ScheduleDonationRequest(BaseModel):
    scheduled_at: datetime


class CheckItemRequest(BaseModel):
    action: str = Field(pattern="^(accepted|rejected)$")
    condition_actual: ItemCondition | None = None
    check_note: str | None = Field(default=None, max_length=2000)
    reject_reason: str | None = Field(default=None, max_length=1000)
    images: list[DonationImageIn] = Field(default_factory=list)


class DonationImageOut(BaseModel):
    id: uuid.UUID
    donation_item_id: uuid.UUID
    image_url: str
    type: ImageType


class DonationItemOut(BaseModel):
    id: uuid.UUID
    donation_id: uuid.UUID
    name: str
    category_id: uuid.UUID | None = None
    quantity: int
    condition_declared: ItemCondition
    condition_actual: ItemCondition | None = None
    check_note: str | None = None
    checked_by: uuid.UUID | None = None
    checked_at: datetime | None = None
    status: DonationItemStatus
    reject_reason: str | None = None
    images: list[DonationImageOut] = Field(default_factory=list)


class DonationOut(BaseModel):
    id: uuid.UUID
    code: str
    donor_id: uuid.UUID
    group_id: uuid.UUID
    title: str
    description: str | None = None
    status: DonationStatus
    pickup_method: PickupMethod
    pickup_address: str | None = None
    scheduled_at: datetime | None = None
    received_at: datetime | None = None
    rejected_reason: str | None = None
    reviewed_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    items: list[DonationItemOut] = Field(default_factory=list)


class TimelineEntryOut(BaseModel):
    at: datetime
    event: str
    note: str | None = None
    actor_id: uuid.UUID | None = None
    ref_type: str | None = None
    ref_id: uuid.UUID | None = None
