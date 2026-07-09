"""RabbitMQ consumer for events this service reacts to.

Currently handles `report.resolved` with action=lock_account (see docs/flows.md
Luồng 9): locks the account and revokes all its refresh tokens.

Runs on its own connection/queue (`identity.events`) started in the app
lifespan. Each message is processed inside a fresh pooled DB transaction.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

import aio_pika

from app.core.config import settings
from app.core.database import get_pool
from app.events.event_names import REPORT_RESOLVED
from app.models.enums import AccountStatus
from app.repositories.account import AccountRepository
from app.repositories.refresh_token import RefreshTokenRepository

logger = logging.getLogger(__name__)

_QUEUE_NAME = "identity.events"
_MAX_BACKOFF_SECONDS = 30


class EventConsumer:
    def __init__(self) -> None:
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._retry_task: asyncio.Task | None = None

    async def _open(self) -> None:
        """Connect, declare, bind and start consuming. Raises on failure."""
        self._connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)

        exchange = await self._channel.declare_exchange(
            settings.rabbitmq_exchange,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        queue = await self._channel.declare_queue(_QUEUE_NAME, durable=True)
        await queue.bind(exchange, routing_key=REPORT_RESOLVED)
        await queue.consume(self._on_message)
        logger.info("EventConsumer listening on %s", _QUEUE_NAME)

    async def start(self) -> None:
        """Called from the app lifespan. Never raises — retries in background."""
        try:
            await self._open()
            return
        except Exception:
            await self._reset()
            logger.warning(
                "EventConsumer could not start; retrying in background"
            )
            self._retry_task = asyncio.create_task(self._retry_forever())

    async def _retry_forever(self) -> None:
        backoff = 1
        while self._connection is None:
            await asyncio.sleep(backoff)
            try:
                await self._open()
                logger.info("EventConsumer started after retry")
                return
            except Exception:
                await self._reset()
                backoff = min(backoff * 2, _MAX_BACKOFF_SECONDS)

    async def _reset(self) -> None:
        if self._connection is not None:
            try:
                await self._connection.close()
            except Exception:
                pass
        self._connection = None
        self._channel = None

    async def close(self) -> None:
        if self._retry_task is not None:
            self._retry_task.cancel()
            self._retry_task = None
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            self._channel = None

    async def _on_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            try:
                payload = json.loads(message.body.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                logger.warning("Discarding malformed message on %s", _QUEUE_NAME)
                return

            routing_key = message.routing_key
            if routing_key == REPORT_RESOLVED:
                await self._handle_report_resolved(payload)

    async def _handle_report_resolved(self, payload: dict) -> None:
        if payload.get("action") != "lock_account":
            return
        raw_id = payload.get("accountId") or payload.get("userId")
        if not raw_id:
            logger.warning("report.resolved lock_account missing account id")
            return
        try:
            account_id = uuid.UUID(str(raw_id))
        except ValueError:
            logger.warning("report.resolved invalid account id: %s", raw_id)
            return

        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                accounts = AccountRepository(conn)
                tokens = RefreshTokenRepository(conn)
                await accounts.set_status(account_id, AccountStatus.locked)
                revoked = await tokens.revoke_all_for_account(account_id)
        logger.info(
            "Locked account %s and revoked %d refresh tokens", account_id, revoked
        )


consumer = EventConsumer()
