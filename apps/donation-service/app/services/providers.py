from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.deps import DbConn
from app.events.publisher import publisher
from app.services.donations import DonationService
from app.services.inventory import InventoryService


def get_donation_service(conn: DbConn) -> DonationService:
    return DonationService(conn, publisher)


def get_inventory_service(conn: DbConn) -> InventoryService:
    return InventoryService(conn, publisher)


DonationServiceDep = Annotated[DonationService, Depends(get_donation_service)]
InventoryServiceDep = Annotated[InventoryService, Depends(get_inventory_service)]
