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
            token = _str(p, "token")
            if email and token:
                url = f"{settings.frontend_base}/verify-email?token={token}"
                await email_service.send_verification_email(
                    email=email,
                    verification_url=url,
                    expires_at=_str(p, "expiresAt"),
                )
            return

        if event_name == E.PASSWORD_RESET_REQUESTED:
            email = _str(p, "email")
            token = _str(p, "token")
            if email and token:
                url = f"{settings.frontend_base}/reset-password?token={token}"
                await email_service.send_password_reset_email(
                    email=email,
                    reset_url=url,
                    expires_at=_str(p, "expiresAt"),
                )
            return

        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await self._dispatch_with_db(conn, event_name, p)

    async def _dispatch_with_db(self, conn, event_name: str, p: dict[str, Any]) -> None:
        if event_name == E.DONATION_CREATED:
            donation_id = _str(p, "donationId")
            donor_id = _str(p, "donorId")
            group_id = _str(p, "groupId")
            code = _str(p, "code") or donation_id
            if donation_id and donor_id and group_id:
                await chat_service.ensure_conversation(
                    conn,
                    type_="donor_group",
                    group_id=group_id,
                    user_id=donor_id,
                    context_type="donation",
                    context_id=donation_id,
                    system_message=(
                        f"Hội thoại quyên góp {code} đã được tạo. "
                        "Nhóm sẽ phản hồi tại đây."
                    ),
                )
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p),
                type_="donation_created",
                title="Có đơn quyên góp mới",
                body=f"Mã {code} cần được xem xét.",
                ref_type="donation",
                ref_id=donation_id,
            )
            return

        if event_name == E.DONATION_REVIEWED:
            action = _str(p, "action")
            accepted = action == "accepted"
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "donorId")],
                type_="donation_reviewed",
                title=(
                    "Đơn quyên góp đã được chấp nhận"
                    if accepted
                    else "Đơn quyên góp bị từ chối"
                ),
                body=(
                    "Nhóm đã chấp nhận đơn. Vui lòng theo dõi lịch hẹn."
                    if accepted
                    else (_str(p, "reason") or "Nhóm đã từ chối đơn quyên góp.")
                ),
                ref_type="donation",
                ref_id=_str(p, "donationId"),
            )
            return

        if event_name == E.DONATION_SCHEDULED:
            donation_id = _str(p, "donationId")
            scheduled_at = _str(p, "scheduledAt")
            recipients = [_str(p, "donorId"), *_ids(p)]
            await noti_service.notify_users(
                conn,
                user_ids=recipients,
                type_="donation_scheduled",
                title="Đã hẹn lịch nhận đồ quyên góp",
                body=f"Thời gian: {scheduled_at}" if scheduled_at else "Kiểm tra lịch hẹn.",
                ref_type="donation",
                ref_id=donation_id,
            )
            if scheduled_at:
                await reminder_service.schedule_for_users(
                    conn,
                    recipients,
                    ref_type="donation",
                    ref_id=donation_id,
                    scheduled_at_iso=scheduled_at,
                )
            return

        if event_name == E.DONATION_COMPLETED:
            accepted = int(p.get("acceptedItems") or 0)
            rejected = int(p.get("rejectedItems") or 0)
            body = f"{accepted} món đã nhập kho"
            if rejected:
                body += f", {rejected} món bị từ chối"
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "donorId")],
                type_="donation_completed",
                title="Hoàn tất quyên góp",
                body=body,
                ref_type="donation",
                ref_id=_str(p, "donationId"),
            )
            return

        if event_name == E.REQUEST_CREATED:
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p),
                type_="request_created",
                title="Yêu cầu nhận đồ mới",
                body="Có người đăng ký nhận đồ từ gian hàng.",
                ref_type="request",
                ref_id=_str(p, "requestId"),
            )
            return

        if event_name == E.REQUEST_APPROVED:
            request_id = _str(p, "requestId")
            receiver_id = _str(p, "receiverId")
            group_id = _str(p, "groupId")
            if request_id and receiver_id and group_id:
                await chat_service.ensure_conversation(
                    conn,
                    type_="receiver_group",
                    group_id=group_id,
                    user_id=receiver_id,
                    context_type="request",
                    context_id=request_id,
                    system_message=(
                        "Yêu cầu nhận đồ đã được duyệt. "
                        "Bạn có thể nhắn tin với nhóm tại đây."
                    ),
                )
            await noti_service.notify_users(
                conn,
                user_ids=[receiver_id],
                type_="request_approved",
                title="Yêu cầu nhận đồ được duyệt",
                body="Nhóm đã chấp nhận. Vui lòng chờ lịch hẹn trao tặng.",
                ref_type="request",
                ref_id=request_id,
            )
            return

        if event_name == E.REQUEST_SCHEDULED:
            request_id = _str(p, "requestId")
            scheduled_at = _str(p, "scheduledAt")
            recipients = [_str(p, "receiverId"), *_ids(p)]
            await noti_service.notify_users(
                conn,
                user_ids=recipients,
                type_="request_scheduled",
                title="Đã hẹn lịch nhận đồ",
                body=f"Thời gian: {scheduled_at}" if scheduled_at else "Kiểm tra lịch hẹn.",
                ref_type="request",
                ref_id=request_id,
            )
            if scheduled_at:
                await reminder_service.schedule_for_users(
                    conn,
                    recipients,
                    ref_type="request",
                    ref_id=request_id,
                    scheduled_at_iso=scheduled_at,
                )
            return

        if event_name == E.REQUEST_COMPLETED:
            await noti_service.notify_users(
                conn,
                user_ids=[_str(p, "receiverId"), _str(p, "donorId"), *_ids(p)],
                type_="request_completed",
                title="Đã trao tặng thành công",
                body="Giao dịch hoàn tất. Hãy đánh giá trải nghiệm nếu được mời.",
                ref_type="request",
                ref_id=_str(p, "requestId"),
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
                body="Giờ bạn có thể xem gian hàng và đăng ký nhận đồ.",
                ref_type="group",
                ref_id=_str(p, "groupId"),
            )
            return

        if event_name == E.LISTING_CREATED:
            await noti_service.notify_users(
                conn,
                user_ids=_ids(p),
                type_="listing_created",
                title="Có đồ mới trên gian hàng",
                body="Nhóm vừa đăng món đồ mới — vào xem ngay.",
                ref_type="listing",
                ref_id=_str(p, "listingId"),
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
