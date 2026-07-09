from __future__ import annotations

from typing import Any

import asyncpg
from fastapi import HTTPException, status

from app.repositories.chat import ChatRepository
from app.services import notifications as noti_service


async def ensure_conversation(
    conn: asyncpg.Connection,
    *,
    type_: str,
    group_id: str,
    user_id: str,
    context_type: str,
    context_id: str,
    system_message: str | None = None,
) -> dict[str, Any]:
    repo = ChatRepository(conn)
    existing = await repo.get_conversation_by_context(context_type, context_id)
    if existing:
        return existing

    conv = await repo.find_or_create_conversation(
        type_=type_,
        group_id=group_id,
        user_id=user_id,
        context_type=context_type,
        context_id=context_id,
    )
    if system_message and conv.get("id"):
        await repo.insert_message(
            conversation_id=str(conv["id"]),
            sender_id=user_id,
            sender_side="group",
            type_="system",
            content=system_message,
        )
    return conv


async def list_conversations(
    conn: asyncpg.Connection, user_id: str, group_id: str | None = None
) -> list[dict[str, Any]]:
    return await ChatRepository(conn).list_for_user(user_id, group_id)


async def list_messages(
    conn: asyncpg.Connection,
    conversation_id: str,
    user_id: str,
    *,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    await _assert_access(conn, conversation_id, user_id)
    return await ChatRepository(conn).list_messages(conversation_id, limit, offset)


async def send_message(
    conn: asyncpg.Connection,
    *,
    conversation_id: str,
    sender_id: str,
    content: str,
    type_: str = "text",
    as_group: bool = False,
) -> dict[str, Any]:
    content = (content or "").strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty message")

    conv = await _assert_access(conn, conversation_id, sender_id)
    msg_type = "image" if type_ == "image" else "text"

    # user seat of conversation → side user; others / as_group → group (moderator inbox MVP)
    if as_group or str(conv["user_id"]) != sender_id:
        sender_side = "group"
    else:
        sender_side = "user"

    message = await ChatRepository(conn).insert_message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        sender_side=sender_side,
        type_=msg_type,
        content=content,
    )

    # Push to conversation user when group side replies
    if sender_side == "group":
        recipient = str(conv["user_id"])
        if recipient != sender_id:
            await noti_service.notify_users(
                conn,
                user_ids=[recipient],
                type_="chat_message",
                title="Tin nhắn mới",
                body=content[:120],
                ref_type="conversation",
                ref_id=conversation_id,
            )

    return message


async def mark_read(
    conn: asyncpg.Connection, conversation_id: str, user_id: str
) -> None:
    await _assert_access(conn, conversation_id, user_id)
    await ChatRepository(conn).mark_read(conversation_id, user_id)


async def _assert_access(
    conn: asyncpg.Connection, conversation_id: str, user_id: str
) -> dict[str, Any]:
    conv = await ChatRepository(conn).get_conversation(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )
    # MVP: allow conversation user always; others treated as group-side (tighten via Community later)
    return conv
