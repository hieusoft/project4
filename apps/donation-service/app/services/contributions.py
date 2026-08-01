from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.clients.community import community_client
from app.core.deps import CurrentUser
from app.events import event_names
from app.events.contracts import (
    ContributionCompletedEvent,
    ContributionCreatedEvent,
    ContributionReviewedEvent,
)
from app.events.publisher import EventPublisher
from app.models.domain import Contribution, ContributionItem
from app.models.enums import ContributionItemStatus, ContributionStatus
from app.repositories.campaigns import CampaignRepository
from app.repositories.contributions import ContributionRepository
from app.schemas.contributions import (
    CheckItemRequest,
    CreateContributionRequest,
    ReviewContributionRequest,
)
from datetime import date


class ContributionService:
    def __init__(self, conn, publisher: EventPublisher) -> None:
        self._conn = conn
        self._contribs = ContributionRepository(conn)
        self._campaigns = CampaignRepository(conn)
        self._publisher = publisher

    async def create(
        self, user: CurrentUser, data: CreateContributionRequest
    ) -> Contribution:
        campaign = await self._campaigns.get(data.campaign_id)
        if campaign is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        if campaign.status != "active":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Campaign is not active (status={campaign.status})",
            )

        # Chỉ thành viên đã được duyệt của hội nhóm mới được đóng góp. Trước đây
        # bất kỳ ai có token đều gửi được đơn vào đợt của nhóm mình không tham gia.
        #
        # PLATFORM_ADMIN cũng không được miễn trừ: quyên góp là hành vi tham gia
        # cộng đồng, không phải kiểm duyệt. Quyền quản trị (duyệt đơn, kiểm
        # vật phẩm) vẫn miễn trừ ở `_require_moderator`.
        is_member = await community_client.is_group_member(
            campaign.group_id, user.raw_token
        )
        if not is_member:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "You must join this group before contributing",
            )

        campaign_item_ids = {it.id for it in campaign.items}
        for ci in data.items:
            if ci.campaign_item_id not in campaign_item_ids:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"campaign_item_id {ci.campaign_item_id} does not belong to this campaign",
                )

        contribution = await self._contribs.create(
            code=None,  # repository tự sinh + retry khi trùng
            campaign_id=data.campaign_id,
            donor_id=user.uuid,
            pickup_method=data.pickup_method.value,
            pickup_address=data.pickup_address,
        )
        for ci in data.items:
            item = await self._contribs.add_item(
                contribution_id=contribution.id,
                campaign_item_id=ci.campaign_item_id,
                name=ci.name,
                quantity=ci.quantity,
                condition_declared=ci.condition_declared.value,
            )
            for img in ci.images:
                await self._contribs.add_image(
                    contribution_item_id=item.id,
                    image_url=img.image_url,
                    image_type=img.type.value,
                )

        contribution = await self._contribs.get(contribution.id)
        assert contribution is not None

        await self._campaigns.upsert_daily_stat(
            stat_date=date.today(),
            group_id=campaign.group_id,
            field="contributions_count",
        )
        await self._campaigns.upsert_daily_stat(
            stat_date=date.today(), group_id=None, field="contributions_count"
        )

        await self._publisher.publish(
            event_names.CONTRIBUTION_CREATED,
            ContributionCreatedEvent(
                contributionId=str(contribution.id),
                campaignId=str(contribution.campaign_id),
                donorId=str(contribution.donor_id),
                code=contribution.code,
            ),
        )
        return contribution

    async def get(
        self, contribution_id: uuid.UUID, user: CurrentUser | None = None
    ) -> Contribution:
        contribution = await self._contribs.get(contribution_id)
        if contribution is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Contribution not found")
        if user is not None:
            await self._require_visibility(contribution, user)
        return contribution

    async def list(
        self,
        user: CurrentUser,
        *,
        campaign_id: uuid.UUID | None = None,
        donor_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        mine: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Contribution], int]:
        """Chỉ trả về những đóng góp người gọi được phép xem.

        - PLATFORM_ADMIN: xem tất cả.
        - Moderator/owner của nhóm: xem mọi đóng góp thuộc campaign của nhóm đó
          (bắt buộc truyền `campaign_id`).
        - Còn lại: chỉ xem đóng góp của chính mình.
        """
        if mine:
            donor_id = user.uuid

        if not user.is_admin:
            can_moderate = False
            if campaign_id is not None and donor_id != user.uuid:
                campaign = await self._campaigns.get(campaign_id)
                if campaign is None:
                    raise HTTPException(
                        status.HTTP_404_NOT_FOUND, "Campaign not found"
                    )
                can_moderate = await community_client.is_group_moderator(
                    campaign.group_id, user.uuid, user.raw_token
                )
            if not can_moderate:
                # Ép về chính chủ, kể cả khi client cố truyền donor_id khác.
                donor_id = user.uuid

        return await self._contribs.list(
            campaign_id=campaign_id,
            donor_id=donor_id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )

    async def _require_visibility(
        self, contribution: Contribution, user: CurrentUser
    ) -> None:
        """Người xem phải là admin, chính chủ, hoặc moderator của nhóm."""
        if user.is_admin or contribution.donor_id == user.uuid:
            return
        campaign = await self._campaigns.get(contribution.campaign_id)
        if campaign is not None:
            ok = await community_client.is_group_moderator(
                campaign.group_id, user.uuid, user.raw_token
            )
            if ok:
                return
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You do not have permission to view this contribution",
        )

    async def review(
        self,
        contribution_id: uuid.UUID,
        user: CurrentUser,
        data: ReviewContributionRequest,
    ) -> Contribution:
        contribution = await self.get(contribution_id)
        await self._require_moderator(contribution, user)

        if contribution.status != ContributionStatus.pending.value:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Can only review pending contributions (status={contribution.status})",
            )

        if data.action == "accepted":
            updated = await self._contribs.update_status(
                contribution_id,
                status=ContributionStatus.accepted.value,
                reviewed_by=user.uuid,
            )
        else:
            updated = await self._contribs.update_status(
                contribution_id,
                status=ContributionStatus.rejected.value,
                reviewed_by=user.uuid,
                rejected_reason=data.reason or "Rejected",
            )
        assert updated is not None
        await self._publisher.publish(
            event_names.CONTRIBUTION_REVIEWED,
            ContributionReviewedEvent(
                contributionId=str(updated.id),
                campaignId=str(updated.campaign_id),
                donorId=str(updated.donor_id),
                action=data.action,
                reason=data.reason,
            ),
        )
        return updated

    async def cancel(
        self, contribution_id: uuid.UUID, user: CurrentUser
    ) -> Contribution:
        contribution = await self.get(contribution_id)
        if contribution.donor_id != user.uuid and not user.is_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Only donor can cancel"
            )
        if contribution.status in (
            ContributionStatus.completed.value,
            ContributionStatus.cancelled.value,
            ContributionStatus.rejected.value,
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot cancel contribution in status={contribution.status}",
            )
        updated = await self._contribs.update_status(
            contribution_id, status=ContributionStatus.cancelled.value
        )
        assert updated is not None
        return updated

    async def check_item(
        self,
        contribution_id: uuid.UUID,
        item_id: uuid.UUID,
        user: CurrentUser,
        data: CheckItemRequest,
    ) -> Contribution:
        contribution = await self.get(contribution_id)
        await self._require_moderator(contribution, user)

        if contribution.status not in (
            ContributionStatus.received.value,
            ContributionStatus.accepted.value,
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot check items in status={contribution.status}",
            )

        item = await self._contribs.get_item(item_id)
        if item is None or item.contribution_id != contribution_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
        if item.status != ContributionItemStatus.pending.value:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Item already checked (status={item.status})",
            )

        if data.action == "accepted":
            if not data.condition_actual:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "condition_actual required when accepting item",
                )
            await self._contribs.update_item_check(
                item_id,
                status=ContributionItemStatus.accepted.value,
                condition_actual=data.condition_actual.value,
                check_note=data.check_note,
                checked_by=user.uuid,
                reject_reason=None,
            )
            await self._contribs.bump_campaign_item(
                item.campaign_item_id, item.quantity
            )
            await self._campaigns.upsert_daily_stat(
                stat_date=date.today(),
                group_id=(await self._campaigns.get(contribution.campaign_id)).group_id,
                field="items_received",
            )
            await self._campaigns.upsert_daily_stat(
                stat_date=date.today(), group_id=None, field="items_received"
            )
        else:
            await self._contribs.update_item_check(
                item_id,
                status=ContributionItemStatus.rejected.value,
                condition_actual=data.condition_actual.value if data.condition_actual else None,
                check_note=data.check_note,
                checked_by=user.uuid,
                reject_reason=data.reject_reason or "Rejected",
            )

        for img in data.images:
            await self._contribs.add_image(
                contribution_item_id=item_id,
                image_url=img.image_url,
                image_type=img.type.value if img.type else "actual_check",
            )

        if contribution.status == ContributionStatus.accepted.value:
            await self._contribs.update_status(
                contribution_id,
                status=ContributionStatus.received.value,
                received_at=datetime.now(timezone.utc),
            )

        contribution = await self.get(contribution_id)
        pending = [
            i for i in contribution.items
            if i.status == ContributionItemStatus.pending.value
        ]
        if not pending:
            accepted = sum(
                1 for i in contribution.items
                if i.status == ContributionItemStatus.accepted.value
            )
            rejected = sum(
                1 for i in contribution.items
                if i.status == ContributionItemStatus.rejected.value
            )
            final = (
                ContributionStatus.completed.value
                if accepted > 0
                else ContributionStatus.rejected.value
            )
            contribution = await self._contribs.update_status(
                contribution_id, status=final
            )
            assert contribution is not None
            await self._publisher.publish(
                event_names.CONTRIBUTION_COMPLETED,
                ContributionCompletedEvent(
                    contributionId=str(contribution.id),
                    campaignId=str(contribution.campaign_id),
                    donorId=str(contribution.donor_id),
                    acceptedItems=accepted,
                    rejectedItems=rejected,
                ),
            )
        return contribution

    async def _require_moderator(
        self, contribution: Contribution, user: CurrentUser
    ) -> None:
        if user.is_admin:
            return
        campaign = await self._campaigns.get(contribution.campaign_id)
        if campaign is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        ok = await community_client.is_group_moderator(
            campaign.group_id, user.uuid, user.raw_token
        )
        if not ok:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Moderator or owner of the group required",
            )
