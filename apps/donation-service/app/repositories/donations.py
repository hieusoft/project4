from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

from app.models.domain import Donation, DonationImage, DonationItem


def _donation(row: asyncpg.Record, items: list[DonationItem] | None = None) -> Donation:
    return Donation(
        id=row["id"],
        code=row["code"],
        donor_id=row["donor_id"],
        group_id=row["group_id"],
        title=row["title"],
        description=row["description"],
        status=row["status"],
        pickup_method=row["pickup_method"],
        pickup_address=row["pickup_address"],
        scheduled_at=row["scheduled_at"],
        received_at=row["received_at"],
        rejected_reason=row["rejected_reason"],
        reviewed_by=row["reviewed_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        items=items or [],
    )


def _item(row: asyncpg.Record, images: list[DonationImage] | None = None) -> DonationItem:
    return DonationItem(
        id=row["id"],
        donation_id=row["donation_id"],
        name=row["name"],
        category_id=row["category_id"],
        quantity=row["quantity"],
        condition_declared=row["condition_declared"],
        condition_actual=row["condition_actual"],
        check_note=row["check_note"],
        checked_by=row["checked_by"],
        checked_at=row["checked_at"],
        status=row["status"],
        reject_reason=row["reject_reason"],
        images=images or [],
    )


def _image(row: asyncpg.Record) -> DonationImage:
    return DonationImage(
        id=row["id"],
        donation_item_id=row["donation_item_id"],
        image_url=row["image_url"],
        type=row["type"],
    )


class DonationRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def next_code(self, prefix: str = "DON") -> str:
        year = datetime.utcnow().year
        n = await self._conn.fetchval(
            "SELECT COUNT(*) + 1 FROM donations WHERE EXTRACT(YEAR FROM created_at) = $1",
            year,
        )
        return f"{prefix}-{year}-{int(n):05d}"

    async def create(
        self,
        *,
        code: str,
        donor_id: uuid.UUID,
        group_id: uuid.UUID,
        title: str,
        description: str | None,
        pickup_method: str,
        pickup_address: str | None,
    ) -> Donation:
        row = await self._conn.fetchrow(
            """
            INSERT INTO donations (
              code, donor_id, group_id, title, description,
              pickup_method, pickup_address, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
            RETURNING *
            """,
            code,
            donor_id,
            group_id,
            title,
            description,
            pickup_method,
            pickup_address,
        )
        return _donation(row)

    async def add_item(
        self,
        *,
        donation_id: uuid.UUID,
        name: str,
        category_id: uuid.UUID | None,
        quantity: int,
        condition_declared: str,
    ) -> DonationItem:
        row = await self._conn.fetchrow(
            """
            INSERT INTO donation_items (
              donation_id, name, category_id, quantity, condition_declared, status
            ) VALUES ($1,$2,$3,$4,$5,'pending')
            RETURNING *
            """,
            donation_id,
            name,
            category_id,
            quantity,
            condition_declared,
        )
        return _item(row)

    async def add_image(
        self,
        *,
        donation_item_id: uuid.UUID,
        image_url: str,
        image_type: str = "declared",
    ) -> DonationImage:
        row = await self._conn.fetchrow(
            """
            INSERT INTO donation_images (donation_item_id, image_url, type)
            VALUES ($1,$2,$3::image_type)
            RETURNING *
            """,
            donation_item_id,
            image_url,
            image_type,
        )
        return _image(row)

    async def get(self, donation_id: uuid.UUID) -> Donation | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM donations WHERE id = $1", donation_id
        )
        if row is None:
            return None
        items = await self.list_items(donation_id)
        return _donation(row, items)

    async def list_items(self, donation_id: uuid.UUID) -> list[DonationItem]:
        rows = await self._conn.fetch(
            "SELECT * FROM donation_items WHERE donation_id = $1 ORDER BY id",
            donation_id,
        )
        if not rows:
            return []
        item_ids = [r["id"] for r in rows]
        img_rows = await self._conn.fetch(
            "SELECT * FROM donation_images WHERE donation_item_id = ANY($1::uuid[])",
            item_ids,
        )
        by_item: dict[uuid.UUID, list[DonationImage]] = {i: [] for i in item_ids}
        for ir in img_rows:
            by_item[ir["donation_item_id"]].append(_image(ir))
        return [_item(r, by_item.get(r["id"], [])) for r in rows]

    async def get_item(self, item_id: uuid.UUID) -> DonationItem | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM donation_items WHERE id = $1", item_id
        )
        if row is None:
            return None
        imgs = await self._conn.fetch(
            "SELECT * FROM donation_images WHERE donation_item_id = $1", item_id
        )
        return _item(row, [_image(i) for i in imgs])

    async def list(
        self,
        *,
        donor_id: uuid.UUID | None = None,
        group_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Donation], int]:
        clauses: list[str] = ["1=1"]
        params: list = []
        if donor_id is not None:
            params.append(donor_id)
            clauses.append(f"donor_id = ${len(params)}")
        if group_id is not None:
            params.append(group_id)
            clauses.append(f"group_id = ${len(params)}")
        if status is not None:
            params.append(status)
            clauses.append(f"status = ${len(params)}")
        where = " AND ".join(clauses)
        total = await self._conn.fetchval(
            f"SELECT COUNT(*) FROM donations WHERE {where}", *params
        )
        params.extend([limit, offset])
        rows = await self._conn.fetch(
            f"""
            SELECT * FROM donations
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ${len(params) - 1} OFFSET ${len(params)}
            """,
            *params,
        )
        donations = []
        for r in rows:
            items = await self.list_items(r["id"])
            donations.append(_donation(r, items))
        return donations, int(total or 0)

    async def update_status(
        self,
        donation_id: uuid.UUID,
        *,
        status: str,
        reviewed_by: uuid.UUID | None = None,
        rejected_reason: str | None = None,
        scheduled_at: datetime | None = None,
        received_at: datetime | None = None,
    ) -> Donation | None:
        row = await self._conn.fetchrow(
            """
            UPDATE donations SET
              status = $2::donation_status,
              reviewed_by = COALESCE($3, reviewed_by),
              rejected_reason = COALESCE($4, rejected_reason),
              scheduled_at = COALESCE($5, scheduled_at),
              received_at = COALESCE($6, received_at),
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            donation_id,
            status,
            reviewed_by,
            rejected_reason,
            scheduled_at,
            received_at,
        )
        if row is None:
            return None
        items = await self.list_items(donation_id)
        return _donation(row, items)

    async def update_item_check(
        self,
        item_id: uuid.UUID,
        *,
        status: str,
        condition_actual: str | None,
        check_note: str | None,
        checked_by: uuid.UUID,
        reject_reason: str | None,
    ) -> DonationItem | None:
        row = await self._conn.fetchrow(
            """
            UPDATE donation_items SET
              status = $2::donation_item_status,
              condition_actual = $3::item_condition,
              check_note = $4,
              checked_by = $5,
              checked_at = NOW(),
              reject_reason = $6
            WHERE id = $1
            RETURNING *
            """,
            item_id,
            status,
            condition_actual,
            check_note,
            checked_by,
            reject_reason,
        )
        if row is None:
            return None
        imgs = await self._conn.fetch(
            "SELECT * FROM donation_images WHERE donation_item_id = $1", item_id
        )
        return _item(row, [_image(i) for i in imgs])
