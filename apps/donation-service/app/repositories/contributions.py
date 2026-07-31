from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

from app.models.domain import Contribution, ContributionImage, ContributionItem


_CONTRIB_COLS = """
    id, code, campaign_id, donor_id, status, pickup_method, pickup_address,
    received_at, rejected_reason, reviewed_by, reviewed_at,
    created_at, updated_at
"""

_ITEM_COLS = """
    id, contribution_id, campaign_item_id, name, quantity, condition_declared,
    condition_actual, check_note, checked_by, checked_at, status, reject_reason
"""


def _contribution(
    row: asyncpg.Record, items: list[ContributionItem] | None = None
) -> Contribution:
    return Contribution(
        id=row["id"],
        code=row["code"],
        campaign_id=row["campaign_id"],
        donor_id=row["donor_id"],
        status=row["status"],
        pickup_method=row["pickup_method"],
        pickup_address=row["pickup_address"],
        pickup_address=row["pickup_address"],
        received_at=row["received_at"],
        rejected_reason=row["rejected_reason"],
        reviewed_by=row["reviewed_by"],
        reviewed_at=row["reviewed_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        items=items or [],
    )


def _item(row: asyncpg.Record, images: list[ContributionImage] | None = None) -> ContributionItem:
    return ContributionItem(
        id=row["id"],
        contribution_id=row["contribution_id"],
        campaign_item_id=row["campaign_item_id"],
        name=row["name"],
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


def _image(row: asyncpg.Record) -> ContributionImage:
    return ContributionImage(
        id=row["id"],
        contribution_item_id=row["contribution_item_id"],
        image_url=row["image_url"],
        type=row["type"],
    )


class ContributionRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def next_code(self, prefix: str = "CTR") -> str:
        year = datetime.utcnow().year
        pattern = f"{prefix}-{year}-%"
        max_code = await self._conn.fetchval(
            "SELECT MAX(code) FROM contributions WHERE code LIKE $1", pattern
        )
        n = 1
        if max_code:
            try:
                n = int(str(max_code).rsplit("-", 1)[-1]) + 1
            except ValueError:
                n = 1
        return f"{prefix}-{year}-{n:05d}"

    async def create(
        self,
        *,
        code: str,
        campaign_id: uuid.UUID,
        donor_id: uuid.UUID,
        pickup_method: str,
        pickup_address: str | None,
    ) -> Contribution:
        row = await self._conn.fetchrow(
            f"""
            INSERT INTO contributions (
              code, campaign_id, donor_id, pickup_method, pickup_address, status
            ) VALUES ($1,$2,$3,$4,$5,'pending')
            RETURNING {_CONTRIB_COLS}
            """,
            code,
            campaign_id,
            donor_id,
            pickup_method,
            pickup_address,
        )
        return _contribution(row)

    async def add_item(
        self,
        *,
        contribution_id: uuid.UUID,
        campaign_item_id: uuid.UUID,
        name: str,
        quantity: int,
        condition_declared: str,
    ) -> ContributionItem:
        row = await self._conn.fetchrow(
            f"""
            INSERT INTO contribution_items (
              contribution_id, campaign_item_id, name, quantity,
              condition_declared, status
            ) VALUES ($1,$2,$3,$4,$5,'pending')
            RETURNING {_ITEM_COLS}
            """,
            contribution_id,
            campaign_item_id,
            name,
            quantity,
            condition_declared,
        )
        return _item(row)

    async def add_image(
        self,
        *,
        contribution_item_id: uuid.UUID,
        image_url: str,
        image_type: str = "declared",
    ) -> ContributionImage:
        row = await self._conn.fetchrow(
            """
            INSERT INTO contribution_images (contribution_item_id, image_url, type)
            VALUES ($1,$2,$3::image_type)
            RETURNING *
            """,
            contribution_item_id,
            image_url,
            image_type,
        )
        return _image(row)

    async def get(self, contribution_id: uuid.UUID) -> Contribution | None:
        row = await self._conn.fetchrow(
            f"SELECT {_CONTRIB_COLS} FROM contributions WHERE id = $1",
            contribution_id,
        )
        if row is None:
            return None
        items = await self.list_items(contribution_id)
        return _contribution(row, items)

    async def list_items(self, contribution_id: uuid.UUID) -> list[ContributionItem]:
        rows = await self._conn.fetch(
            f"SELECT {_ITEM_COLS} FROM contribution_items WHERE contribution_id = $1 ORDER BY id",
            contribution_id,
        )
        if not rows:
            return []
        item_ids = [r["id"] for r in rows]
        img_rows = await self._conn.fetch(
            "SELECT * FROM contribution_images WHERE contribution_item_id = ANY($1::uuid[])",
            item_ids,
        )
        by_item: dict[uuid.UUID, list[ContributionImage]] = {i: [] for i in item_ids}
        for ir in img_rows:
            by_item[ir["contribution_item_id"]].append(_image(ir))
        return [_item(r, by_item.get(r["id"], [])) for r in rows]

    async def get_item(self, item_id: uuid.UUID) -> ContributionItem | None:
        row = await self._conn.fetchrow(
            f"SELECT {_ITEM_COLS} FROM contribution_items WHERE id = $1", item_id
        )
        if row is None:
            return None
        imgs = await self._conn.fetch(
            "SELECT * FROM contribution_images WHERE contribution_item_id = $1", item_id
        )
        return _item(row, [_image(i) for i in imgs])

    async def list(
        self,
        *,
        campaign_id: uuid.UUID | None = None,
        donor_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Contribution], int]:
        clauses: list[str] = ["1=1"]
        params: list = []
        if campaign_id is not None:
            params.append(campaign_id)
            clauses.append(f"campaign_id = ${len(params)}")
        if donor_id is not None:
            params.append(donor_id)
            clauses.append(f"donor_id = ${len(params)}")
        if status is not None:
            params.append(status)
            clauses.append(f"status = ${len(params)}")
        where = " AND ".join(clauses)
        total = await self._conn.fetchval(
            f"SELECT COUNT(*) FROM contributions WHERE {where}", *params
        )
        params.extend([limit, offset])
        rows = await self._conn.fetch(
            f"""
            SELECT {_CONTRIB_COLS} FROM contributions
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ${len(params) - 1} OFFSET ${len(params)}
            """,
            *params,
        )
        return [_contribution(r) for r in rows], int(total or 0)

    async def update_status(
        self,
        contribution_id: uuid.UUID,
        *,
        status: str,
        reviewed_by: uuid.UUID | None = None,
        rejected_reason: str | None = None,
        received_at: datetime | None = None,
    ) -> Contribution | None:
        row = await self._conn.fetchrow(
            f"""
            UPDATE contributions SET
              status = $2::contribution_status,
              reviewed_by = COALESCE($3, reviewed_by),
              rejected_reason = COALESCE($4, rejected_reason),
              received_at = COALESCE($5, received_at),
              reviewed_at = CASE
                WHEN $3 IS NOT NULL AND reviewed_at IS NULL THEN NOW()
                ELSE reviewed_at
              END,
              updated_at = NOW()
            WHERE id = $1
            RETURNING {_CONTRIB_COLS}
            """,
            contribution_id,
            status,
            reviewed_by,
            rejected_reason,
            received_at,
        )
        if row is None:
            return None
        items = await self.list_items(contribution_id)
        return _contribution(row, items)

    async def update_item_check(
        self,
        item_id: uuid.UUID,
        *,
        status: str,
        condition_actual: str | None,
        check_note: str | None,
        checked_by: uuid.UUID,
        reject_reason: str | None,
    ) -> ContributionItem | None:
        row = await self._conn.fetchrow(
            f"""
            UPDATE contribution_items SET
              status = $2::contribution_item_status,
              condition_actual = $3::item_condition,
              check_note = $4,
              checked_by = $5,
              checked_at = NOW(),
              reject_reason = $6
            WHERE id = $1
            RETURNING {_ITEM_COLS}
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
            "SELECT * FROM contribution_images WHERE contribution_item_id = $1", item_id
        )
        return _item(row, [_image(i) for i in imgs])

    async def bump_campaign_item(
        self, campaign_item_id: uuid.UUID, quantity: int
    ) -> None:
        await self._conn.execute(
            """
            UPDATE campaign_items
            SET received_quantity = received_quantity + $2
            WHERE id = $1
            """,
            campaign_item_id,
            quantity,
        )
