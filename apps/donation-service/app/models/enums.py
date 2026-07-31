from __future__ import annotations

from enum import Enum


class CampaignStatus(str, Enum):
    active = "active"
    fulfilled = "fulfilled"
    closed = "closed"
    cancelled = "cancelled"


class ContributionStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    received = "received"
    completed = "completed"
    rejected = "rejected"
    cancelled = "cancelled"


class ContributionItemStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class PickupMethod(str, Enum):
    drop_off = "drop_off"
    pickup = "pickup"


class ItemCondition(str, Enum):
    new = "new"
    like_new = "like_new"
    good = "good"
    used = "used"
    worn = "worn"


class ImageType(str, Enum):
    declared = "declared"
    actual_check = "actual_check"
