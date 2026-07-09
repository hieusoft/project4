"""Background cron that removes orphaned temp media.

Temp media = presigned/uploaded but never linked to a business entity (user
abandoned the upload, or an entity edit unlinked it). After temp_ttl_hours we
delete the R2 object and hard-delete the row.

Runs as an asyncio background task started in the app lifespan: one sweep at
startup (clears leftovers) then every cleanup_interval_minutes. A failed sweep
is logged and swallowed so the loop keeps running.
"""
from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.core.database import get_pool
from app.repositories.media import MediaRepository
from app.services import r2

logger = logging.getLogger(__name__)


async def cleanup_expired_temp() -> int:
    pool = get_pool()
    async with pool.acquire() as conn:
        repo = MediaRepository(conn)
        # Read outside a write transaction; each delete is independent.
        expired = await repo.find_expired_temp(settings.temp_ttl_hours)

    removed = 0
    for media in expired:
        try:
            await r2.delete_object(media.bucket_key)
        except Exception as exc:  # object may never have been PUT — ignore
            logger.warning(
                "cleanup: cannot delete R2 object %s: %s", media.bucket_key, exc
            )
        async with pool.acquire() as conn:
            await MediaRepository(conn).delete_by_id(media.id)
        removed += 1

    if removed:
        logger.info(
            "cleanup: removed %d expired temp media older than %dh",
            removed,
            settings.temp_ttl_hours,
        )
    return removed


async def run_cleanup_loop() -> None:
    interval_seconds = settings.cleanup_interval_minutes * 60
    while True:
        try:
            await cleanup_expired_temp()
        except Exception:
            logger.exception("cleanup sweep failed")
        await asyncio.sleep(interval_seconds)
