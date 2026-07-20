from __future__ import annotations

from pydantic import BaseModel


class DonationCreatedEvent(BaseModel):
    donationId: str
    donorId: str
    groupId: str
    code: str
    notifyUserIds: list[str] | None = None


class DonationReviewedEvent(BaseModel):
    donationId: str
    donorId: str
    groupId: str
    action: str  # accepted | rejected
    reason: str | None = None


class DonationScheduledEvent(BaseModel):
    donationId: str
    donorId: str
    groupId: str
    scheduledAt: str
    notifyUserIds: list[str] | None = None


class DonationCompletedEvent(BaseModel):
    donationId: str
    donorId: str
    groupId: str
    acceptedItems: int
    rejectedItems: int


class InventoryImportedEvent(BaseModel):
    inventoryItemId: str
    donationItemId: str
    groupId: str
    donorId: str


class ItemStatusChangedEvent(BaseModel):
    inventoryItemId: str
    fromStatus: str | None = None
    toStatus: str
    refType: str | None = None
    refId: str | None = None
