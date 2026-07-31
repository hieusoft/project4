"""RabbitMQ consumer: email, notifications, conversations, reminders."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import aio_pika

from app.core.config import settings
from app.core.database import get_pool
from app.events import event_names as E
from app.services import chat as chat_service
from app.services import email as email_service
from app.services import notifications as noti_service
from app.services import reminders as reminder_service

logger = logging.getLogger(__name__)

_MAX_BACKOFF = 30


def _str(payload: dict[str, Any], key: str) -> str:
    v = payload.get(key)
    return str(v) if v is not None else ""


def _ids(payload: dict[str, Any], key: str = "notifyUserIds") -> list[str]:
    v = payload.get(key)
    if not isinstance(v, list):
        return []
    return [str(x) for x in v if x]


class EventConsumer:
    def __init__(self) -> None:
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._retry_task: asyncio.Task | None = None

    async def _open(self) -> None:
        self._connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)
        exchange = await self._channel.declare_exchange(
            settings.rabbitmq_exchange,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        queue = await self._channel.declare_queue(
            settings.communication_events_queue, durable=True
        )
        await queue.bind(exchange, routing_key="#")
        await queue.consume(self._on_message)
        logger.info(
            "EventConsumer listening on %s", settings.communication_events_queue
        )

    async def start(self) -> None:
        try:
            await self._open()
            return
        except Exception:
            await self._reset()
            logger.warning("EventConsumer could not start; retrying in background")
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
                backoff = min(backoff * 2, _MAX_BACKOFF)

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
                body = json.loads(message.body.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                logger.warning("Discarding malformed message")
                return

            if isinstance(body, dict) and "payload" in body:
                event_name = body.get("eventName") or message.routing_key
                payload = body.get("payload") or {}
            else:
                event_name = message.routing_key
                payload = body if isinstance(body, dict) else {}

            if not isinstance(payload, dict):
                payload = {}

            try:
                await self._dispatch(str(event_name), payload)
            except Exception:
                logger.exception("Failed handling %s", event_name)
                raise

    async def _dispatch(self, event_name: str, p: dict[str, Any]) -> None:
        if event_name == E.EMAIL_VERIFICATION_REQUESTED:
            email = _str(p, "email")
            # Prefer 6-digit OTP (`code`); accept legacy `token` only if it looks numeric.
            code = _str(p, "code") or _str(p, "token")
            if email and code:
                await email_service.send_verification_email(
                    email=email,
                    code=code,
                    expires_at=_str(p, "expiresAt"),
                )
            return

        if event_name == E.EMAIL_VERIFIED:
            email = _str(p, "email")
            if email:
                await email_service.send_verification_success_email(email=email)
            return

        if event_name == E.PASSWORD_RESET_REQUESTED:
            email = _str(p, "email")
            code = _str(p, "code") or _str(p, "token")
            if email and code:
                await email_service.send_password_reset_email(
                    email=email,
                    code=code,
                    expires_at=_str(p, "expiresAt"),
                )
            return

        if event_name == E.PASSWORD_RESET_COMPLETED:
            email = _str(p, "email")
            if email:
                await email_service.send_password_changed_email(email=email)
            return

        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await self._dispatch_with_db(conn, event_name, p)

    async def _dispatch_with_db(self, conn, event_name: str, p: dict[str, Any]) -> None:
        if event_name == E.CAMPAIGN_CREATED:
            campaign_id = _str(p, "campaignId")
            group_id = _str(p, "groupId")
            title = _str(p, "title")
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p),
                type_="campaign_created",
                title="Có đợt quyên góp mới",
                body=f'"{title}" đang nhận đóng góp.' if title else "Có đợt quyên góp mới.",
                ref_type="campaign",
                ref_id=campaign_id,
            )
            return

        if event_name == E.CAMPAIGN_CLOSED:
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p, "donorIds"),
                type_="campaign_closed",
                title="Đợt quyên góp đã đóng",
                body=_str(p, "reason") or "Đợt quyên góp đã kết thúc.",
                ref_type="campaign",
                ref_id=_str(p, "campaignId"),
            )
            return

        if event_name == E.CAMPAIGN_DELIVERED:
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p, "donorIds"),
                type_="campaign_delivered",
                title="Đồ quyên góp đã đến tay người cần",
                body=_str(p, "deliveryNote") or "Đợt quyên góp đã được trao tặng thành công.",
                ref_type="campaign",
                ref_id=_str(p, "campaignId"),
            )
            return

        if event_name == E.CONTRIBUTION_CREATED:
            contribution_id = _str(p, "contributionId")
            campaign_id = _str(p, "campaignId")
            donor_id = _str(p, "donorId")
            group_id = _str(p, "groupId") or ""
            code = _str(p, "code") or contribution_id
            if contribution_id and donor_id and group_id:
                await chat_service.ensure_conversation(
                    conn,
                    type_="donor_group",
                    group_id=group_id,
                    user_id=donor_id,
                    context_type="contribution",
                    context_id=contribution_id,
                    system_message=(
                        f"Hội thoại đóng góp {code} đã được tạo. "
                        "Nhóm sẽ phản hồi tại đây."
                    ),
                )
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p),
                type_="contribution_created",
                title="Có người đóng góp mới",
                body=f"Mã đóng góp {code} cần được xem xét.",
                ref_type="contribution",
                ref_id=contribution_id,
            )
            return

        if event_name == E.CONTRIBUTION_REVIEWED:
            action = _str(p, "action")
            accepted = action == "accepted"
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "donorId")],
                type_="contribution_reviewed",
                title=(
                    "Đóng góp đã được chấp nhận"
                    if accepted
                    else "Đóng góp bị từ chối"
                ),
                body=(
                    "Nhóm đã chấp nhận đóng góp. Vui lòng theo dõi lịch hẹn."
                    if accepted
                    else (_str(p, "reason") or "Nhóm đã từ chối đóng góp.")
                ),
                ref_type="contribution",
                ref_id=_str(p, "contributionId"),
            )
            return

        if event_name == E.CONTRIBUTION_COMPLETED:
            accepted = int(p.get("acceptedItems") or 0)
            rejected = int(p.get("rejectedItems") or 0)
            body = f"{accepted} món đã đạt kiểm tra"
            if rejected:
                body += f", {rejected} món bị từ chối"
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "donorId")],
                type_="contribution_completed",
                title="Hoàn tất kiểm tra đóng góp",
                body=body,
                ref_type="contribution",
                ref_id=_str(p, "contributionId"),
            )
            return

        if event_name == E.GROUP_APPROVED:
            name = _str(p, "name")
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "ownerId")],
                type_="group_approved",
                title="Hội nhóm đã được duyệt",
                body=f'Nhóm "{name}" đã active.' if name else "Hội nhóm đã được phê duyệt.",
                ref_type="group",
                ref_id=_str(p, "groupId"),
            )
            return

        if event_name == E.GROUP_JOIN_REQUESTED:
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p),
                type_="group_join_requested",
                title="Yêu cầu tham gia nhóm",
                body="Có người xin tham gia hội nhóm.",
                ref_type="group",
                ref_id=_str(p, "groupId"),
            )
            return

        if event_name == E.GROUP_MEMBER_APPROVED:
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "userId")],
                type_="group_member_approved",
                title="Bạn đã được duyệt vào nhóm",
                body="Giờ bạn có thể tham gia các đợt quyên góp của nhóm.",
                ref_type="group",
                ref_id=_str(p, "groupId"),
            )
            return

        if event_name == E.MESSAGE_SENT:
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p, "recipientUserIds"),
                type_="chat_message",
                title="Tin nhắn mới",
                body=_str(p, "preview") or "Bạn có tin nhắn mới.",
                ref_type="conversation",
                ref_id=_str(p, "conversationId"),
            )


consumer = EventConsumer()
