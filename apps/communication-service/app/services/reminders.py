"""Scheduled appointment reminders (background loop)."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.database import get_pool
from app.repositories.reminders import RemindersRepository
from app.services import notifications as noti_service

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None


async def schedule_for_users(
    conn,
    user_ids: list[str],
    *,
    ref_type: str,
    ref_id: str,
    scheduled_at_iso: str,
) -> None:
    try:
        scheduled_at = datetime.fromisoformat(scheduled_at_iso.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Invalid scheduledAt: %s", scheduled_at_iso)
        return

    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    remind_at = scheduled_at - timedelta(hours=settings.reminder_lead_hours)
    now = datetime.now(timezone.utc)
    if remind_at <= now:
        remind_at = now + timedelta(minutes=1)

    repo = RemindersRepository(conn)
    seen: set[str] = set()
    for uid in user_ids:
        s = str(uid).strip() if uid else ""
        if not s or s in seen:
            continue
        seen.add(s)
        await repo.schedule(
            user_id=s, ref_type=ref_type, ref_id=ref_id, remind_at=remind_at
        )


async def process_due() -> None:
    try:
        pool = get_pool()
    except RuntimeError:
        return
    async with pool.acquire() as conn:
        async with conn.transaction():
            due = await RemindersRepository(conn).find_due()
            for row in due:
                await noti_service.notify_users(
                    conn,
                    user_ids=[str(row["user_id"])],
                    type_="schedule_reminder",
                    title="Nhắc lịch hẹn",
                    body=f"Bạn có lịch {row['ref_type']} sắp tới. Vui lòng kiểm tra ứng dụng.",
                    ref_type=str(row["ref_type"]),
                    ref_id=str(row["ref_id"]),
                )
                await RemindersRepository(conn).mark_sent(str(row["id"]))
            if due:
                logger.info("Processed %s reminder(s)", len(due))


async def _loop() -> None:
    while True:
        try:
            await process_due()
        except Exception:
            logger.exception("Reminder sweep failed")
        await asyncio.sleep(settings.reminder_interval_seconds)


async def start_reminder_loop() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())
        logger.info(
            "Reminder loop every %ss (lead %sh)",
            settings.reminder_interval_seconds,
            settings.reminder_lead_hours,
        )


async def stop_reminder_loop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
