"""RabbitMQ publisher using aio-pika.

Publishes domain events to the topic exchange `charity.events` (declared in
infra/rabbitmq/definitions.json). Publishing never blocks the request path
fatally: if the broker is unavailable, the error is logged and swallowed so
auth flows still succeed (events are best-effort notifications).

Connection robustness: aio_pika.connect_robust only auto-reconnects *after* a
first successful connect. To survive the broker not being ready at startup
(a common compose ordering race), the initial connect is retried in a
background task with backoff, and publish() attempts a lazy connect if the
publisher is still down.
"""
from __future__ import annotations

import asyncio
import json
import logging

import aio_pika
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_BACKOFF_SECONDS = 30


class EventPublisher:
    def __init__(self) -> None:
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None
        self._lock = asyncio.Lock()
        self._retry_task: asyncio.Task | None = None

    async def _open(self) -> None:
        """Open connection/channel/exchange. Raises on failure."""
        self._connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        self._channel = await self._connection.channel(publisher_confirms=True)
        # Matches the durable topic exchange from definitions.json.
        self._exchange = await self._channel.declare_exchange(
            settings.rabbitmq_exchange,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        logger.info(
            "EventPublisher connected to exchange %s", settings.rabbitmq_exchange
        )

    async def _ensure_connected(self) -> bool:
        """Try to (re)connect if needed. Returns True when the exchange is ready."""
        if self._exchange is not None:
            return True
        async with self._lock:
            if self._exchange is not None:
                return True
            try:
                await self._open()
                return True
            except Exception:
                self._connection = None
                self._channel = None
                self._exchange = None
                return False

    async def connect(self) -> None:
        """Called from the app lifespan. Never raises — retries in background."""
        if await self._ensure_connected():
            return
        logger.warning(
            "EventPublisher could not connect at startup; retrying in background"
        )
        self._retry_task = asyncio.create_task(self._retry_forever())

    async def _retry_forever(self) -> None:
        backoff = 1
        while self._exchange is None:
            await asyncio.sleep(backoff)
            if await self._ensure_connected():
                logger.info("EventPublisher connected after retry")
                return
            backoff = min(backoff * 2, _MAX_BACKOFF_SECONDS)

    async def close(self) -> None:
        if self._retry_task is not None:
            self._retry_task.cancel()
            self._retry_task = None
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            self._channel = None
            self._exchange = None

    async def publish(self, routing_key: str, payload: BaseModel | dict) -> None:
        body = (
            payload.model_dump_json()
            if isinstance(payload, BaseModel)
            else json.dumps(payload)
        )
        # Lazy connect: recover even if the broker was down at startup.
        if not await self._ensure_connected():
            logger.warning(
                "EventPublisher not connected; dropping event %s", routing_key
            )
            return
        try:
            assert self._exchange is not None
            await self._exchange.publish(
                aio_pika.Message(
                    body=body.encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=routing_key,
            )
            logger.debug("Published %s", routing_key)
        except Exception:  # best-effort — do not fail the request
            logger.exception("Failed to publish event %s", routing_key)


# Singleton shared across the app (wired in the lifespan).
publisher = EventPublisher()
