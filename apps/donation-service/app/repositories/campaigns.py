from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import asyncpg

from app.models.domain import Campaign, CampaignDelivery, CampaignItem, Category


_CAMPAIGN_COLS = """
    id, code, group_id, title, description, province_code, district_code,
    beneficiary_description, status, deadline, created_by, fulfilled_at,
    closed_at, created_at, updated_at
"""

_ITEM_COLS = """
    id, campaign_id, name, category_id, target_quantity, received_quantity,
    unit, condition_required, note
"""


def _campaign(row: asyncpg.Record, items: list[CampaignItem] | None = None) -> Campaign:
    return Campaign(
        id=row["id"],
        code=row["code"],
        group_id=row["group_id"],
        title=row["title"],
        description=row["description"],
        province_code=row["province_code"],
        district_code=row["district_code"],
        beneficiary_description=row["beneficiary_description"],
        status=row["status"],
        deadline=row["deadline"],
        created_by=row["created_by"],
        fulfilled_at=row["fulfilled_at"],
        closed_at=row["closed_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        items=items or [],
    )


def _item(row: asyncpg.Record) -> CampaignItem:
    return CampaignItem(
        id=row["id"],
        campaign_id=row["campaign_id"],
        name=row["name"],
        category_id=row["category_id"],
        target_quantity=row["target_quantity"],
        received_quantity=row["received_quantity"],
        unit=row["unit"],
        condition_required=row["condition_required"],
        note=row["note"],
    )


def _delivery(row: asyncpg.Record) -> CampaignDelivery:
    return CampaignDelivery(
        id=row["id"],
        campaign_id=row["campaign_id"],
        confirmed_by=row["confirmed_by"],
        delivery_photo_url=row["delivery_photo_url"],
        delivery_note=row["delivery_note"],
        delivered_at=row["delivered_at"],
    )


class CampaignRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def next_code(self, prefix: str = "CP") -> str:
        """Sinh mã kế tiếp dạng CP-<year>-00001.

        So sánh theo SỐ, không theo chuỗi: `MAX(code)` trả 'CP-2026-002' thay vì
        'CP-2026-00003' (ký tự thứ 9: '2' > '0'), khiến số thứ tự bị lùi và sinh
        ra mã đã tồn tại -> vi phạm UNIQUE -> 500. Dữ liệu cũ có thể lẫn 3 và 5
        chữ số nên phải ép kiểu phần số rồi mới lấy max.
        """
        year = datetime.now(timezone.utc).year
        pattern = f"{prefix}-{year}-%"
        n = await self._conn.fetchval(
            """
            SELECT COALESCE(MAX(NULLIF(regexp_replace(
                split_part(code, '-', 3), '\\D', '', 'g'
            ), '')::bigint), 0) + 1
            FROM campaigns
            WHERE code LIKE $1
            """,
            pattern,
        )
        return f"{prefix}-{year}-{int(n or 1):05d}"

    async def create(
        self,
        *,
        code: str | None = None,
        group_id: uuid.UUID,
        title: str,
        description: str | None,
        province_code: str | None,
        district_code: str | None,
        beneficiary_description: str | None,
        deadline: date | None,
        created_by: uuid.UUID,
    ) -> Campaign:
        """Tạo campaign. Nếu `code` là None thì tự sinh và thử lại khi trùng.

        Hai request đồng thời có thể cùng đọc ra một số thứ tự; UNIQUE sẽ chặn
        request thứ hai, nên bắt UniqueViolation rồi sinh lại thay vì trả 500.
        """
        attempts = 5 if code is None else 1
        last_error: Exception | None = None
        for _ in range(attempts):
            candidate = code or await self.next_code()
            try:
                row = await self._conn.fetchrow(
                    f"""
                    INSERT INTO campaigns (
                      code, group_id, title, description, province_code, district_code,
                      beneficiary_description, deadline, created_by, status
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
                    RETURNING {_CAMPAIGN_COLS}
                    """,
                    candidate,
                    group_id,
                    title,
                    description,
                    province_code,
                    district_code,
                    beneficiary_description,
                    deadline,
                    created_by,
                )
                return _campaign(row)
            except asyncpg.UniqueViolationError as exc:
                last_error = exc
                if code is not None:
                    raise
        raise last_error  # type: ignore[misc]

    async def add_item(
        self,
        *,
        campaign_id: uuid.UUID,
        name: str,
        category_id: uuid.UUID | None,
        target_quantity: int,
        unit: str | None,
        condition_required: str | None,
        note: str | None,
    ) -> CampaignItem:
        row = await self._conn.fetchrow(
            f"""
            INSERT INTO campaign_items (
              campaign_id, name, category_id, target_quantity, unit,
              condition_required, note
            ) VALUES ($1,$2,$3,$4,$5,$6::item_condition,$7)
            RETURNING {_ITEM_COLS}
            """,
            campaign_id,
            name,
            category_id,
            target_quantity,
            unit,
            condition_required,
            note,
        )
        return _item(row)

    async def get(self, campaign_id: uuid.UUID) -> Campaign | None:
        row = await self._conn.fetchrow(
            f"SELECT {_CAMPAIGN_COLS} FROM campaigns WHERE id = $1", campaign_id
        )
        if row is None:
            return None
        items = await self.list_items(campaign_id)
        return _campaign(row, items)

    async def list_items(self, campaign_id: uuid.UUID) -> list[CampaignItem]:
        rows = await self._conn.fetch(
            f"SELECT {_ITEM_COLS} FROM campaign_items WHERE campaign_id = $1 ORDER BY id",
            campaign_id,
        )
        return [_item(r) for r in rows]

    async def list_items_for(
        self, campaign_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[CampaignItem]]:
        """Nạp items của nhiều campaign trong MỘT query (tránh N+1)."""
        if not campaign_ids:
            return {}
        rows = await self._conn.fetch(
            f"""
            SELECT {_ITEM_COLS} FROM campaign_items
            WHERE campaign_id = ANY($1::uuid[])
            ORDER BY campaign_id, id
            """,
            campaign_ids,
        )
        grouped: dict[uuid.UUID, list[CampaignItem]] = {
            cid: [] for cid in campaign_ids
        }
        for r in rows:
            grouped.setdefault(r["campaign_id"], []).append(_item(r))
        return grouped

    async def list(
        self,
        *,
        group_id: uuid.UUID | None = None,
        status: str | None = None,
        province_code: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Campaign], int]:
        clauses: list[str] = ["1=1"]
        params: list = []
        if group_id is not None:
            params.append(group_id)
            clauses.append(f"group_id = ${len(params)}")
        if status is not None:
            params.append(status)
            clauses.append(f"status = ${len(params)}")
        if province_code is not None:
            params.append(province_code)
            clauses.append(f"province_code = ${len(params)}")
        where = " AND ".join(clauses)
        total = await self._conn.fetchval(
            f"SELECT COUNT(*) FROM campaigns WHERE {where}", *params
        )
        params.extend([limit, offset])
        rows = await self._conn.fetch(
            f"""
            SELECT {_CAMPAIGN_COLS} FROM campaigns
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ${len(params) - 1} OFFSET ${len(params)}
            """,
            *params,
        )
        # Trả kèm items: client cần danh sách vật phẩm ngay ở màn danh sách
        # (chọn vật phẩm để quyên góp, hiển thị tiến độ) mà không phải gọi
        # thêm /campaigns/{id} cho từng đợt.
        items_by_campaign = await self.list_items_for([r["id"] for r in rows])
        return (
            [_campaign(r, items_by_campaign.get(r["id"], [])) for r in rows],
            int(total or 0),
        )

    async def update(
        self,
        campaign_id: uuid.UUID,
        *,
        title: str | None = None,
        description: str | None = None,
        beneficiary_description: str | None = None,
        deadline: date | None = None,
    ) -> Campaign | None:
        row = await self._conn.fetchrow(
            f"""
            UPDATE campaigns SET
              title = COALESCE($2, title),
              description = COALESCE($3, description),
              beneficiary_description = COALESCE($4, beneficiary_description),
              deadline = COALESCE($5, deadline),
              updated_at = NOW()
            WHERE id = $1
            RETURNING {_CAMPAIGN_COLS}
            """,
            campaign_id,
            title,
            description,
            beneficiary_description,
            deadline,
        )
        if row is None:
            return None
        items = await self.list_items(campaign_id)
        return _campaign(row, items)

    async def update_status(
        self,
        campaign_id: uuid.UUID,
        *,
        status: str,
        fulfilled_at: datetime | None = None,
        closed_at: datetime | None = None,
    ) -> Campaign | None:
        row = await self._conn.fetchrow(
            f"""
            UPDATE campaigns SET
              status = $2::campaign_status,
              fulfilled_at = COALESCE($3, fulfilled_at),
              closed_at = COALESCE($4, closed_at),
              updated_at = NOW()
            WHERE id = $1
            RETURNING {_CAMPAIGN_COLS}
            """,
            campaign_id,
            status,
            fulfilled_at,
            closed_at,
        )
        if row is None:
            return None
        items = await self.list_items(campaign_id)
        return _campaign(row, items)

    async def get_delivery(self, campaign_id: uuid.UUID) -> CampaignDelivery | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM campaign_deliveries WHERE campaign_id = $1", campaign_id
        )
        return _delivery(row) if row else None

    async def create_delivery(
        self,
        *,
        campaign_id: uuid.UUID,
        confirmed_by: uuid.UUID,
        delivery_photo_url: str | None,
        delivery_note: str | None,
    ) -> CampaignDelivery:
        row = await self._conn.fetchrow(
            """
            INSERT INTO campaign_deliveries (
              campaign_id, confirmed_by, delivery_photo_url, delivery_note
            ) VALUES ($1,$2,$3,$4)
            RETURNING *
            """,
            campaign_id,
            confirmed_by,
            delivery_photo_url,
            delivery_note,
        )
        return _delivery(row)

    async def upsert_daily_stat(
        self, *, stat_date: date, group_id: uuid.UUID | None, field: str
    ) -> None:
        if group_id is not None:
            await self._conn.execute(
                f"""
                INSERT INTO daily_stats (stat_date, group_id, {field})
                VALUES ($1, $2, 1)
                ON CONFLICT (stat_date, group_id)
                DO UPDATE SET {field} = daily_stats.{field} + 1
                """,
                stat_date,
                group_id,
            )
        else:
            existing = await self._conn.fetchval(
                "SELECT id FROM daily_stats WHERE stat_date = $1 AND group_id IS NULL",
                stat_date,
            )
            if existing:
                await self._conn.execute(
                    f"UPDATE daily_stats SET {field} = {field} + 1 WHERE id = $1",
                    existing,
                )
            else:
                await self._conn.execute(
                    f"INSERT INTO daily_stats (stat_date, group_id, {field}) VALUES ($1, NULL, 1)",
                    stat_date,
                )


class CategoryRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_active(self) -> list[Category]:
        rows = await self._conn.fetch(
            "SELECT * FROM categories WHERE is_active = true ORDER BY sort_order, name"
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
