from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.clients.community import community_client
from app.core.deps import CurrentUser
from app.events import event_names
from app.events.contracts import (
    DonationCompletedEvent,
    DonationCreatedEvent,
    DonationReviewedEvent,
    DonationScheduledEvent,
    InventoryImportedEvent,
)
from app.events.publisher import EventPublisher
from app.models.domain import Donation, DonationItem
from app.models.enums import DonationItemStatus, DonationStatus
from app.repositories.donations import DonationRepository
from app.repositories.inventory import InventoryRepository
from app.schemas.donations import (
    CheckItemRequest,
    CreateDonationRequest,
    ReviewDonationRequest,
    ScheduleDonationRequest,
)


class DonationService:
    def __init__(self, conn, publisher: EventPublisher) -> None:
        self._conn = conn
        self._donations = DonationRepository(conn)
        self._inventory = InventoryRepository(conn)
        self._publisher = publisher

    async def create(
        self, user: CurrentUser, data: CreateDonationRequest
    ) -> Donation:
        await community_client.ensure_group_active(data.group_id, user.raw_token)

        code = await self._donations.next_code()
        donation = await self._donations.create(
            code=code,
            donor_id=user.uuid,
            group_id=data.group_id,
            title=data.title,
            description=data.description,
            pickup_method=data.pickup_method.value,
            pickup_address=data.pickup_address,
        )

        items: list[DonationItem] = []
        for it in data.items:
            item = await self._donations.add_item(
                donation_id=donation.id,
                name=it.name,
                category_id=it.category_id,
                quantity=it.quantity,
                condition_declared=it.condition_declared.value,
            )
            images = []
            for img in it.images:
                images.append(
                    await self._donations.add_image(
                        donation_item_id=item.id,
                        image_url=img.image_url,
                        image_type=img.type.value,
                    )
                )
            item.images = images
            items.append(item)
        donation.items = items

        await self._publisher.publish(
            event_names.DONATION_CREATED,
            DonationCreatedEvent(
                donationId=str(donation.id),
                donorId=str(donation.donor_id),
                groupId=str(donation.group_id),
                code=donation.code,
            ),
        )
        return donation

    async def get(self, donation_id: uuid.UUID, user: CurrentUser | None) -> Donation:
        donation = await self._donations.get(donation_id)
        if donation is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Donation not found")
        return donation

    async def list(
        self,
        user: CurrentUser,
        *,
        group_id: uuid.UUID | None = None,
        donor_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        mine: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Donation], int]:
        if mine:
            donor_id = user.uuid
        return await self._donations.list(
            donor_id=donor_id,
            group_id=group_id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )

    async def _require_moderator(
        self, donation: Donation, user: CurrentUser
    ) -> None:
        if user.is_admin:
            return
        ok = await community_client.is_group_moderator(
            donation.group_id, user.uuid, user.raw_token
        )
        if not ok:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Moderator or owner of the group required",
            )

    async def review(
        self,
        donation_id: uuid.UUID,
        user: CurrentUser,
        data: ReviewDonationRequest,
    ) -> Donation:
        donation = await self.get(donation_id, user)
        await self._require_moderator(donation, user)

        if donation.status != DonationStatus.pending.value:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Can only review pending donations (status={donation.status})",
            )

        if data.action == "accepted":
            updated = await self._donations.update_status(
                donation_id,
                status=DonationStatus.accepted.value,
                reviewed_by=user.uuid,
            )
        else:
            updated = await self._donations.update_status(
                donation_id,
                status=DonationStatus.rejected.value,
                reviewed_by=user.uuid,
                rejected_reason=data.reason or "Rejected",
            )

        assert updated is not None
        await self._publisher.publish(
            event_names.DONATION_REVIEWED,
            DonationReviewedEvent(
                donationId=str(updated.id),
                donorId=str(updated.donor_id),
                groupId=str(updated.group_id),
                action=data.action,
                reason=data.reason,
            ),
        )
        return updated

    async def schedule(
        self,
        donation_id: uuid.UUID,
        user: CurrentUser,
        data: ScheduleDonationRequest,
    ) -> Donation:
        donation = await self.get(donation_id, user)
        await self._require_moderator(donation, user)

        if donation.status not in (
            DonationStatus.accepted.value,
            DonationStatus.scheduled.value,
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Can only schedule accepted donations (status={donation.status})",
            )

        updated = await self._donations.update_status(
            donation_id,
            status=DonationStatus.scheduled.value,
            reviewed_by=user.uuid,
            scheduled_at=data.scheduled_at,
        )
        assert updated is not None
        scheduled_iso = (
            data.scheduled_at.astimezone(timezone.utc).isoformat()
            if data.scheduled_at.tzinfo
            else data.scheduled_at.replace(tzinfo=timezone.utc).isoformat()
        )
        await self._publisher.publish(
            event_names.DONATION_SCHEDULED,
            DonationScheduledEvent(
                donationId=str(updated.id),
                donorId=str(updated.donor_id),
                groupId=str(updated.group_id),
                scheduledAt=scheduled_iso,
            ),
        )
        return updated

    async def cancel(self, donation_id: uuid.UUID, user: CurrentUser) -> Donation:
        donation = await self.get(donation_id, user)
        if donation.donor_id != user.uuid and not user.is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only donor can cancel")
        if donation.status in (
            DonationStatus.completed.value,
            DonationStatus.cancelled.value,
            DonationStatus.rejected.value,
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot cancel donation in status={donation.status}",
            )
        updated = await self._donations.update_status(
            donation_id, status=DonationStatus.cancelled.value
        )
        assert updated is not None
        return updated

    async def check_item(
        self,
        donation_id: uuid.UUID,
        item_id: uuid.UUID,
        user: CurrentUser,
        data: CheckItemRequest,
    ) -> Donation:
        donation = await self.get(donation_id, user)
        await self._require_moderator(donation, user)

        if donation.status not in (
            DonationStatus.scheduled.value,
            DonationStatus.received.value,
            DonationStatus.accepted.value,
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot check items in status={donation.status}",
            )

        item = await self._donations.get_item(item_id)
        if item is None or item.donation_id != donation_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
        if item.status != DonationItemStatus.pending.value:
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
            await self._donations.update_item_check(
                item_id,
                status=DonationItemStatus.accepted.value,
                condition_actual=data.condition_actual.value,
                check_note=data.check_note,
                checked_by=user.uuid,
                reject_reason=None,
            )
            for img in data.images:
                await self._donations.add_image(
                    donation_item_id=item_id,
                    image_url=img.image_url,
                    image_type=img.type.value if img.type else "actual_check",
                )

            # Import inventory in same transaction
            inv_code = await self._inventory.next_code()
            inv = await self._inventory.create(
                code=inv_code,
                group_id=donation.group_id,
                donation_item_id=item.id,
                donor_id=donation.donor_id,
                name=item.name,
                category_id=item.category_id,
                quantity=item.quantity,
                condition=data.condition_actual.value,
                note=data.check_note,
            )
            await self._inventory.add_history(
                inventory_item_id=inv.id,
                from_status=None,
                to_status="in_stock",
                actor_id=user.uuid,
                ref_type="donation",
                ref_id=donation.id,
                note="Imported from donation check",
            )
            await self._publisher.publish(
                event_names.INVENTORY_IMPORTED,
                InventoryImportedEvent(
                    inventoryItemId=str(inv.id),
                    donationItemId=str(item.id),
                    groupId=str(donation.group_id),
                    donorId=str(donation.donor_id),
                ),
            )
        else:
            await self._donations.update_item_check(
                item_id,
                status=DonationItemStatus.rejected.value,
                condition_actual=data.condition_actual.value
                if data.condition_actual
                else None,
                check_note=data.check_note,
                checked_by=user.uuid,
                reject_reason=data.reject_reason or "Rejected",
            )
            for img in data.images:
                await self._donations.add_image(
                    donation_item_id=item_id,
                    image_url=img.image_url,
                    image_type=img.type.value if img.type else "actual_check",
                )

        # Mark received if first check
        if donation.status in (
            DonationStatus.scheduled.value,
            DonationStatus.accepted.value,
        ):
            await self._donations.update_status(
                donation_id,
                status=DonationStatus.received.value,
                received_at=datetime.now(timezone.utc),
            )

        # Complete if all items checked
        donation = await self.get(donation_id, user)
        pending = [
            i
            for i in donation.items
            if i.status == DonationItemStatus.pending.value
        ]
        if not pending:
            accepted = sum(
                1
                for i in donation.items
                if i.status == DonationItemStatus.accepted.value
            )
            rejected = sum(
                1
                for i in donation.items
                if i.status == DonationItemStatus.rejected.value
            )
            final = (
                DonationStatus.completed.value
                if accepted > 0
                else DonationStatus.rejected.value
            )
            donation = await self._donations.update_status(
                donation_id, status=final
            )
            assert donation is not None
            await self._publisher.publish(
                event_names.DONATION_COMPLETED,
                DonationCompletedEvent(
                    donationId=str(donation.id),
                    donorId=str(donation.donor_id),
                    groupId=str(donation.group_id),
                    acceptedItems=accepted,
                    rejectedItems=rejected,
                ),
            )
        return donation

    async def timeline(
        self, donation_id: uuid.UUID, user: CurrentUser
    ) -> list[dict]:
        donation = await self.get(donation_id, user)
        entries: list[dict] = [
            {
                "at": donation.created_at,
                "event": "created",
                "note": f"Donation {donation.code} created",
                "actor_id": donation.donor_id,
                "ref_type": "donation",
                "ref_id": donation.id,
            }
        ]
        if donation.reviewed_by:
            entries.append(
                {
                    "at": donation.updated_at,
                    "event": f"reviewed_{donation.status}"
                    if donation.status
                    in (
                        DonationStatus.accepted.value,
                        DonationStatus.rejected.value,
                    )
                    else "reviewed",
                    "note": donation.rejected_reason,
                    "actor_id": donation.reviewed_by,
                    "ref_type": "donation",
                    "ref_id": donation.id,
                }
            )
        if donation.scheduled_at:
            entries.append(
                {
                    "at": donation.scheduled_at,
                    "event": "scheduled",
                    "note": "Pickup/drop-off scheduled",
                    "actor_id": donation.reviewed_by,
                    "ref_type": "donation",
                    "ref_id": donation.id,
                }
            )
        if donation.received_at:
            entries.append(
                {
                    "at": donation.received_at,
                    "event": "received",
                    "note": "Items received for inspection",
                    "actor_id": donation.reviewed_by,
                    "ref_type": "donation",
                    "ref_id": donation.id,
                }
            )

        for item in donation.items:
            if item.checked_at:
                entries.append(
                    {
                        "at": item.checked_at,
                        "event": f"item_{item.status}",
                        "note": item.reject_reason or item.check_note or item.name,
                        "actor_id": item.checked_by,
                        "ref_type": "donation_item",
                        "ref_id": item.id,
                    }
                )
                inv = await self._inventory.get_by_donation_item(item.id)
                if inv:
                    for h in await self._inventory.history(inv.id):
                        entries.append(
                            {
                                "at": h.created_at,
                                "event": f"inventory_{h.to_status}",
                                "note": h.note,
                                "actor_id": h.actor_id,
                                "ref_type": h.ref_type,
                                "ref_id": h.ref_id,
                            }
                        )

        entries.sort(key=lambda e: e["at"] or datetime.min.replace(tzinfo=timezone.utc))
        return entries
