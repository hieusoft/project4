from __future__ import annotations

from enum import Enum


class DonationStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    scheduled = "scheduled"
    received = "received"
    completed = "completed"
    rejected = "rejected"
    cancelled = "cancelled"


class PickupMethod(str, Enum):
    drop_off = "drop_off"
    pickup = "pickup"


class ItemCondition(str, Enum):
    new = "new"
    like_new = "like_new"
    good = "good"
    used = "used"
    worn = "worn"


class DonationItemStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class InventoryStatus(str, Enum):
    in_stock = "in_stock"
    listed = "listed"
    reserved = "reserved"
    delivered = "delivered"
    discarded = "discarded"


class ImageType(str, Enum):
    declared = "declared"
    actual_check = "actual_check"
