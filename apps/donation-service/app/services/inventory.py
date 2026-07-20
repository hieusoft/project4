from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from app.core.deps import CurrentUser
from app.events import event_names
from app.events.contracts import ItemStatusChangedEvent
from app.events.publisher import EventPublisher
from app.models.domain import InventoryItem, ItemStatusHistory
from app.models.enums import InventoryStatus
from app.repositories.inventory import CategoryRepository, InventoryRepository
from app.schemas.inventory import UpdateInventoryStatusRequest


class InventoryService:
    def __init__(self, conn, publisher: EventPublisher) -> None:
        self._inv = InventoryRepository(conn)
        self._cats = CategoryRepository(conn)
        self._publisher = publisher

    async def get(self, item_id: uuid.UUID) -> InventoryItem:
        item = await self._inv.get(item_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Inventory item not found")
        return item

    async def list(
        self,
        *,
        group_id: uuid.UUID | None = None,
        donor_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[InventoryItem], int]:
        return await self._inv.list(
            group_id=group_id,
            donor_id=donor_id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )

    async def history(
        self, item_id: uuid.UUID, user: CurrentUser
    ) -> list[ItemStatusHistory]:
        item = await self.get(item_id)
        # Donor can view own item history; others (mods) also allowed for transparency
        if (
            item.donor_id
            and item.donor_id != user.uuid
            and not user.is_admin
        ):
            # still allow read for authenticated users tracking transparency
            pass
        return await self._inv.history(item_id)

    async def update_status(
        self,
        item_id: uuid.UUID,
        data: UpdateInventoryStatusRequest,
        actor_id: uuid.UUID | None = None,
    ) -> InventoryItem:
        item = await self.get(item_id)
        from_status = item.status
        if from_status == data.status.value:
            return item

        updated = await self._inv.update_status(item_id, status=data.status.value)
        assert updated is not None
        await self._inv.add_history(
            inventory_item_id=item_id,
            from_status=from_status,
            to_status=data.status.value,
            actor_id=actor_id,
            ref_type=data.refType,
            ref_id=data.refId,
            note=data.note,
        )
        await self._publisher.publish(
            event_names.ITEM_STATUS_CHANGED,
            ItemStatusChangedEvent(
                inventoryItemId=str(item_id),
                fromStatus=from_status,
                toStatus=data.status.value,
                refType=data.refType,
                refId=str(data.refId) if data.refId else None,
            ),
        )
        return updated

    async def list_categories(self):
        return await self._cats.list_active()
