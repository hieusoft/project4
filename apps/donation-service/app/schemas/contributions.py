from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import (
    ContributionItemStatus,
    ContributionStatus,
    ImageType,
    ItemCondition,
    PickupMethod,
)


class ContributionImageIn(BaseModel):
    image_url: str = Field(min_length=1, max_length=500)
    type: ImageType = ImageType.declared


class ContributionItemIn(BaseModel):
    campaign_item_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1)
    condition_declared: ItemCondition
    images: list[ContributionImageIn] = Field(default_factory=list)


class CreateContributionRequest(BaseModel):
    campaign_id: uuid.UUID
    pickup_method: PickupMethod = PickupMethod.drop_off
    pickup_address: str | None = Field(default=None, max_length=255)
    items: list[ContributionItemIn] = Field(min_length=1)


class ReviewContributionRequest(BaseModel):
    action: str = Field(pattern="^(accepted|rejected)$")
    reason: str | None = Field(default=None, max_length=1000)


class CheckItemRequest(BaseModel):
    action: str = Field(pattern="^(accepted|rejected)$")
    condition_actual: ItemCondition | None = None
    check_note: str | None = Field(default=None, max_length=2000)
    reject_reason: str | None = Field(default=None, max_length=1000)
    images: list[ContributionImageIn] = Field(default_factory=list)


class ContributionImageOut(BaseModel):
    id: uuid.UUID
    contribution_item_id: uuid.UUID
    image_url: str
    type: ImageType


class ContributionItemOut(BaseModel):
    id: uuid.UUID
    contribution_id: uuid.UUID
    campaign_item_id: uuid.UUID
    name: str
    quantity: int
    condition_declared: ItemCondition
    condition_actual: ItemCondition | None = None
    check_note: str | None = None
    checked_by: uuid.UUID | None = None
    checked_at: datetime | None = None
    status: ContributionItemStatus
    reject_reason: str | None = None
    images: list[ContributionImageOut] = Field(default_factory=list)


class ContributionOut(BaseModel):
    id: uuid.UUID
    code: str
    campaign_id: uuid.UUID
    donor_id: uuid.UUID
    status: ContributionStatus
    pickup_method: PickupMethod
    pickup_address: str | None = None
    received_at: datetime | None = None
    rejected_reason: str | None = None
    reviewed_by: uuid.UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[ContributionItemOut] = Field(default_factory=list)
