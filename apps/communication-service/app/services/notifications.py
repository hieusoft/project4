from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg

from app.repositories.devices import DevicesRepository
from app.repositories.notifications import NotificationsRepository
from app.services import push as push_service

logger = logging.getLogger(__name__)


def _uuid_or_none(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError):
        return None


async def notify_users(
    conn: asyncpg.Connection,
    *,
    user_ids: list[str],
    type_: str,
    title: str,
    body: str | None = None,
    ref_type: str | None = None,
    ref_id: str | None = None,
    do_push: bool = True,
) -> None:
    unique = []
    seen: set[str] = set()
    for uid in user_ids:
        s = str(uid).strip() if uid else ""
        if not s or s in seen:
            continue
        try:
            UUID(s)
        except ValueError:
            continue
        seen.add(s)
        unique.append(s)

    if not unique:
        return

    noti_repo = NotificationsRepository(conn)
    for user_id in unique:
        try:
            await noti_repo.create(
                user_id=user_id,
                type_=type_,
                title=title,
                body=body,
                ref_type=ref_type,
                ref_id=_uuid_or_none(ref_id),
            )
        except Exception:
            logger.exception("Failed to persist notification for %s", user_id)

    if not do_push:
        return

    try:
        tokens = await DevicesRepository(conn).tokens_for_users(unique)
        await push_service.send_push(
            tokens,
            title=title,
            body=body or "",
            data={
                "type": type_,
                "refType": ref_type or "",
                "refId": ref_id or "",
            },
        )
    except Exception:
        logger.exception("Push failed")


async def list_notifications(
    conn: asyncpg.Connection,
    user_id: str,
    *,
    unread_only: bool,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    return await NotificationsRepository(conn).list_for_user(
        user_id, unread_only=unread_only, limit=limit, offset=offset
    )


async def mark_read(
    conn: asyncpg.Connection, notification_id: str, user_id: str
) -> dict[str, Any] | None:
    return await NotificationsRepository(conn).mark_read(notification_id, user_id)


async def mark_all_read(conn: asyncpg.Connection, user_id: str) -> int:
    return await NotificationsRepository(conn).mark_all_read(user_id)
