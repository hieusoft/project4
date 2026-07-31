from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.clients.community import community_client
from app.core.deps import CurrentUser
from app.events import event_names
from app.events.contracts import (
    CampaignClosedEvent,
    CampaignCreatedEvent,
    CampaignDeliveredEvent,
)
from app.events.publisher import EventPublisher
from app.models.domain import Campaign
from app.models.enums import CampaignStatus
from app.repositories.campaigns import CampaignRepository, CategoryRepository
from app.schemas.campaigns import (
    CampaignOut,
    CampaignProgressItemOut,
    CampaignProgressOut,
    CreateCampaignRequest,
    DeliverCampaignRequest,
    UpdateCampaignRequest,
)
from app.schemas.common import PageMeta
from datetime import date


class CampaignService:
    def __init__(self, conn, publisher: EventPublisher) -> None:
        self._conn = conn
        self._campaigns = CampaignRepository(conn)
        self._cats = CategoryRepository(conn)
        self._publisher = publisher

    async def create(self, user: CurrentUser, data: CreateCampaignRequest) -> Campaign:
        await community_client.ensure_group_active(data.group_id, user.raw_token)
        await self._require_moderator(data.group_id, user)

        code = await self._campaigns.next_code()
        campaign = await self._campaigns.create(
            code=code,
            group_id=data.group_id,
            title=data.title,
            description=data.description,
            province_code=data.province_code,
            district_code=data.district_code,
            beneficiary_description=data.beneficiary_description,
            deadline=data.deadline,
            created_by=user.uuid,
        )
        for it in data.items:
            await self._campaigns.add_item(
                campaign_id=campaign.id,
                name=it.name,
                category_id=it.category_id,
                target_quantity=it.target_quantity,
                unit=it.unit,
                condition_required=it.condition_required.value if it.condition_required else None,
                note=it.note,
            )
        campaign = await self._campaigns.get(campaign.id)
        assert campaign is not None

        await self._campaigns.upsert_daily_stat(
            stat_date=date.today(), group_id=data.group_id, field="campaigns_count"
        )
        await self._campaigns.upsert_daily_stat(
            stat_date=date.today(), group_id=None, field="campaigns_count"
        )

        await self._publisher.publish(
            event_names.CAMPAIGN_CREATED,
            CampaignCreatedEvent(
                campaignId=str(campaign.id),
                groupId=str(campaign.group_id),
                code=campaign.code,
                title=campaign.title,
                createdBy=str(campaign.created_by),
            ),
        )
        return campaign

    async def get(self, campaign_id: uuid.UUID) -> Campaign:
        campaign = await self._campaigns.get(campaign_id)
        if campaign is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        return campaign

    async def list(
        self,
        *,
        group_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        province_code: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Campaign], int]:
        return await self._campaigns.list(
            group_id=group_id,
            status=status_filter,
            province_code=province_code,
            limit=limit,
            offset=offset,
        )

    async def update(
        self, campaign_id: uuid.UUID, user: CurrentUser, data: UpdateCampaignRequest
    ) -> Campaign:
        campaign = await self.get(campaign_id)
        await self._require_moderator(campaign.group_id, user)
        if campaign.status not in (CampaignStatus.active.value, CampaignStatus.closed.value):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot update campaign in status={campaign.status}",
            )
        updated = await self._campaigns.update(
            campaign_id,
            title=data.title,
            description=data.description,
            beneficiary_description=data.beneficiary_description,
            deadline=data.deadline,
        )
        assert updated is not None
        return updated

    async def close(
        self, campaign_id: uuid.UUID, user: CurrentUser, reason: str | None = None
    ) -> Campaign:
        campaign = await self.get(campaign_id)
        await self._require_moderator(campaign.group_id, user)
        if campaign.status != CampaignStatus.active.value:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot close campaign in status={campaign.status}",
            )
        updated = await self._campaigns.update_status(
            campaign_id,
            status=CampaignStatus.closed.value,
            closed_at=datetime.now(timezone.utc),
        )
        assert updated is not None
        await self._publisher.publish(
            event_names.CAMPAIGN_CLOSED,
            CampaignClosedEvent(
                campaignId=str(updated.id),
                groupId=str(updated.group_id),
                reason=reason,
            ),
        )
        return updated

    async def deliver(
        self, campaign_id: uuid.UUID, user: CurrentUser, data: DeliverCampaignRequest
    ) -> Campaign:
        campaign = await self.get(campaign_id)
        await self._require_moderator(campaign.group_id, user)
        if campaign.status not in (
            CampaignStatus.active.value,
            CampaignStatus.closed.value,
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot deliver campaign in status={campaign.status}",
            )

        existing = await self._campaigns.get_delivery(campaign_id)
        if existing is not None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Campaign already delivered"
            )

        await self._campaigns.create_delivery(
            campaign_id=campaign_id,
            confirmed_by=user.uuid,
            delivery_photo_url=data.delivery_photo_url,
            delivery_note=data.delivery_note,
        )
        updated = await self._campaigns.update_status(
            campaign_id,
            status=CampaignStatus.fulfilled.value,
            fulfilled_at=datetime.now(timezone.utc),
        )
        assert updated is not None

        from app.repositories.contributions import ContributionRepository

        contrib_repo = ContributionRepository(self._conn)
        contribs, _ = await contrib_repo.list(campaign_id=campaign_id, limit=10000, offset=0)
        donor_ids = list({str(c.donor_id) for c in contribs})

        await self._campaigns.upsert_daily_stat(
            stat_date=date.today(), group_id=campaign.group_id, field="items_delivered"
        )
        await self._campaigns.upsert_daily_stat(
            stat_date=date.today(), group_id=None, field="items_delivered"
        )

        await self._publisher.publish(
            event_names.CAMPAIGN_DELIVERED,
            CampaignDeliveredEvent(
                campaignId=str(updated.id),
                groupId=str(updated.group_id),
                donorIds=donor_ids,
                deliveryNote=data.delivery_note,
            ),
        )
        return updated

    async def progress(self, campaign_id: uuid.UUID) -> CampaignProgressOut:
        campaign = await self.get(campaign_id)
        items_out: list[CampaignProgressItemOut] = []
        fulfilled = 0
        for it in campaign.items:
            remaining = max(it.target_quantity - it.received_quantity, 0)
            is_fulfilled = it.received_quantity >= it.target_quantity
            if is_fulfilled:
                fulfilled += 1
            items_out.append(
                CampaignProgressItemOut(
                    id=it.id,
                    name=it.name,
                    target_quantity=it.target_quantity,
                    received_quantity=it.received_quantity,
                    remaining=remaining,
                    unit=it.unit,
                    fulfilled=is_fulfilled,
                )
            )
        return CampaignProgressOut(
            campaign_id=campaign.id,
            code=campaign.code,
            title=campaign.title,
            status=campaign.status,
            total_targets=len(campaign.items),
            fulfilled_targets=fulfilled,
            items=items_out,
        )

    async def list_categories(self):
        return await self._cats.list_active()

    async def _require_moderator(
        self, group_id: uuid.UUID, user: CurrentUser
    ) -> None:
        if user.is_admin:
            return
        ok = await community_client.is_group_moderator(
            group_id, user.uuid, user.raw_token
        )
        if not ok:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Moderator or owner of the group required",
            )
