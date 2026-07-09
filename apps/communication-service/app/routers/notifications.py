from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUserDep, DbConn
from app.services import notifications as noti_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = str(v) if hasattr(v, "hex") else v
    return out


@router.get("")
async def list_notifications(
    user: CurrentUserDep,
    conn: DbConn,
    unread_only: bool = Query(False, alias="unreadOnly"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    rows = await noti_service.list_notifications(
        conn,
        user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return [_serialize(r) for r in rows]


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: str, user: CurrentUserDep, conn: DbConn):
    row = await noti_service.mark_read(conn, notification_id, user.id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _serialize(row)


@router.post("/read-all")
async def mark_all_read(user: CurrentUserDep, conn: DbConn):
    count = await noti_service.mark_all_read(conn, user.id)
    return {"updated": count}
