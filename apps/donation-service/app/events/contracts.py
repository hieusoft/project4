from __future__ import annotations

from pydantic import BaseModel


class CampaignCreatedEvent(BaseModel):
    campaignId: str
    groupId: str
    code: str
    title: str
    createdBy: str
    notifyUserIds: list[str] | None = None


class CampaignClosedEvent(BaseModel):
    campaignId: str
    groupId: str
    reason: str | None = None


class CampaignDeliveredEvent(BaseModel):
    campaignId: str
    groupId: str
    donorIds: list[str]
    deliveryNote: str | None = None


class ContributionCreatedEvent(BaseModel):
    contributionId: str
    campaignId: str
    donorId: str
    code: str
    notifyUserIds: list[str] | None = None


class ContributionReviewedEvent(BaseModel):
    contributionId: str
    campaignId: str
    donorId: str
    action: str
    reason: str | None = None


class ContributionCompletedEvent(BaseModel):
    contributionId: str
    campaignId: str
    donorId: str
    moderatorId: str | None = None
    acceptedItems: int
    rejectedItems: int
