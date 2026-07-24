from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

from app.models.domain import Category, InventoryItem, ItemStatusHistory


def _inv(row: asyncpg.Record) -> InventoryItem:
    return InventoryItem(
        id=row["id"],
        code=row["code"],
        group_id=row["group_id"],
        donation_item_id=row["donation_item_id"],
        donor_id=row["donor_id"],
        name=row["name"],
        category_id=row["category_id"],
        quantity=row["quantity"],
        condition=row["condition"],
        status=row["status"],
        note=row["note"],
        imported_at=row["imported_at"],
        updated_at=row["updated_at"],
    )


def _hist(row: asyncpg.Record) -> ItemStatusHistory:
    return ItemStatusHistory(
        id=row["id"],
        inventory_item_id=row["inventory_item_id"],
        from_status=row["from_status"],
        to_status=row["to_status"],
        actor_id=row["actor_id"],
        ref_type=row["ref_type"],
        ref_id=row["ref_id"],
        note=row["note"],
        created_at=row["created_at"],
    )


class InventoryRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def next_code(self) -> str:
        year = datetime.utcnow().year
        pattern = f"ITM-{year}-%"
        max_code = await self._conn.fetchval(
            "SELECT MAX(code) FROM inventory_items WHERE code LIKE $1",
            pattern,
        )
        n = 1
        if max_code:
            try:
                n = int(str(max_code).rsplit("-", 1)[-1]) + 1
            except ValueError:
                n = 1
        return f"ITM-{year}-{n:05d}"

    async def create(
        self,
        *,
        code: str,
        group_id: uuid.UUID,
        donation_item_id: uuid.UUID,
        donor_id: uuid.UUID,
        name: str,
        category_id: uuid.UUID | None,
        quantity: int,
        condition: str,
        note: str | None = None,
    ) -> InventoryItem:
        row = await self._conn.fetchrow(
            """
            INSERT INTO inventory_items (
              code, group_id, donation_item_id, donor_id, name,
              category_id, quantity, condition, status, note
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::item_condition,'in_stock',$9)
            RETURNING *
            """,
            code,
            group_id,
            donation_item_id,
            donor_id,
            name,
            category_id,
            quantity,
            condition,
            note,
        )
        return _inv(row)

    async def add_history(
        self,
        *,
        inventory_item_id: uuid.UUID,
        from_status: str | None,
        to_status: str,
        actor_id: uuid.UUID | None = None,
        ref_type: str | None = None,
        ref_id: uuid.UUID | None = None,
        note: str | None = None,
    ) -> ItemStatusHistory:
        row = await self._conn.fetchrow(
            """
            INSERT INTO item_status_histories (
              inventory_item_id, from_status, to_status, actor_id, ref_type, ref_id, note
            ) VALUES (
              $1, $2::inventory_status, $3::inventory_status, $4, $5, $6, $7
            )
            RETURNING *
            """,
            inventory_item_id,
            from_status,
            to_status,
            actor_id,
            ref_type,
            ref_id,
            note,
        )
        return _hist(row)

    async def get(self, item_id: uuid.UUID) -> InventoryItem | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM inventory_items WHERE id = $1", item_id
        )
        return _inv(row) if row else None

    async def get_by_donation_item(
        self, donation_item_id: uuid.UUID
    ) -> InventoryItem | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM inventory_items WHERE donation_item_id = $1",
            donation_item_id,
        )
        return _inv(row) if row else None

    async def list(
        self,
        *,
        group_id: uuid.UUID | None = None,
        donor_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[InventoryItem], int]:
        clauses = ["1=1"]
        params: list = []
        if group_id is not None:
            params.append(group_id)
            clauses.append(f"group_id = ${len(params)}")
        if donor_id is not None:
            params.append(donor_id)
            clauses.append(f"donor_id = ${len(params)}")
        if status is not None:
            params.append(status)
            clauses.append(f"status = ${len(params)}")
        where = " AND ".join(clauses)
        total = await self._conn.fetchval(
            f"SELECT COUNT(*) FROM inventory_items WHERE {where}", *params
        )
        params.extend([limit, offset])
        rows = await self._conn.fetch(
            f"""
            SELECT * FROM inventory_items
            WHERE {where}
            ORDER BY imported_at DESC
            LIMIT ${len(params) - 1} OFFSET ${len(params)}
            """,
            *params,
        )
        return [_inv(r) for r in rows], int(total or 0)

    async def update_status(
        self,
        item_id: uuid.UUID,
        *,
        status: str,
    ) -> InventoryItem | None:
        row = await self._conn.fetchrow(
            """
            UPDATE inventory_items
            SET status = $2::inventory_status, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            item_id,
            status,
        )
        return _inv(row) if row else None

    async def history(
        self, inventory_item_id: uuid.UUID
    ) -> list[ItemStatusHistory]:
        rows = await self._conn.fetch(
            """
            SELECT * FROM item_status_histories
            WHERE inventory_item_id = $1
            ORDER BY created_at ASC
            """,
            inventory_item_id,
        )
        return [_hist(r) for r in rows]


class CategoryRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_active(self) -> list[Category]:
        rows = await self._conn.fetch(
            """
            SELECT * FROM categories
            WHERE is_active = true
            ORDER BY sort_order, name
            """
        )
        return [
            Category(
                id=r["id"],
                name=r["name"],
                slug=r["slug"],
                parent_id=r["parent_id"],
                icon_url=r["icon_url"],
                is_active=r["is_active"],
                sort_order=r["sort_order"],
            )
            for r in rows
        ]
