from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import CampaignStatus, ItemCondition


class CampaignItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category_id: uuid.UUID | None = None
    target_quantity: int = Field(gt=0)
    unit: str | None = Field(default=None, max_length=20)
    condition_required: ItemCondition | None = None
    note: str | None = Field(default=None, max_length=1000)


class CreateCampaignRequest(BaseModel):
    group_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    province_code: str | None = Field(default=None, max_length=10)
    district_code: str | None = Field(default=None, max_length=10)
    beneficiary_description: str | None = Field(default=None, max_length=2000)
    deadline: date | None = None
    items: list[CampaignItemIn] = Field(min_length=1)


class UpdateCampaignRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    beneficiary_description: str | None = Field(default=None, max_length=2000)
    deadline: date | None = None


class CloseCampaignRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


class DeliverCampaignRequest(BaseModel):
    delivery_photo_url: str | None = Field(default=None, max_length=500)
    delivery_note: str | None = Field(default=None, max_length=2000)


class CampaignItemOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    category_id: uuid.UUID | None = None
    target_quantity: int
    received_quantity: int
    unit: str | None = None
    condition_required: ItemCondition | None = None
    note: str | None = None


class CampaignOut(BaseModel):
    id: uuid.UUID
    code: str
    group_id: uuid.UUID
    title: str
    description: str | None = None
    province_code: str | None = None
    district_code: str | None = None
    beneficiary_description: str | None = None
    status: CampaignStatus
    deadline: date | None = None
    created_by: uuid.UUID
    fulfilled_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[CampaignItemOut] = Field(default_factory=list)


class CampaignProgressItemOut(BaseModel):
    id: uuid.UUID
    name: str
    target_quantity: int
    received_quantity: int
    remaining: int
    unit: str | None = None
    fulfilled: bool


class CampaignProgressOut(BaseModel):
    campaign_id: uuid.UUID
    code: str
    title: str
    status: CampaignStatus
    total_targets: int
    fulfilled_targets: int
    items: list[CampaignProgressItemOut]


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    parent_id: uuid.UUID | None = None
    icon_url: str | None = None
    is_active: bool
    sort_order: int
