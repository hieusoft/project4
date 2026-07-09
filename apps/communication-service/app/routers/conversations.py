from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.core.deps import CurrentUserDep, DbConn
from app.realtime.socketio_app import emit_new_message
from app.services import chat as chat_service

router = APIRouter(prefix="/conversations", tags=["chat"])


class SendMessageBody(BaseModel):
    content: str
    type: Literal["text", "image"] = "text"
    as_group: bool = Field(False, alias="asGroup")

    model_config = {"populate_by_name": True}


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        elif hasattr(v, "hex"):
            out[k] = str(v)
        else:
            out[k] = v
    return out


@router.get("")
async def list_conversations(
    user: CurrentUserDep,
    conn: DbConn,
    group_id: str | None = Query(None, alias="groupId"),
):
    rows = await chat_service.list_conversations(conn, user.id, group_id)
    return [_serialize(r) for r in rows]


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user: CurrentUserDep,
    conn: DbConn,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    rows = await chat_service.list_messages(
        conn, conversation_id, user.id, limit=limit, offset=offset
    )
    return [_serialize(r) for r in rows]


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageBody,
    user: CurrentUserDep,
    conn: DbConn,
):
    message = await chat_service.send_message(
        conn,
        conversation_id=conversation_id,
        sender_id=user.id,
        content=body.content,
        type_=body.type,
        as_group=body.as_group,
    )
    payload = _serialize(message)
    await emit_new_message(conversation_id, payload)
    return payload


@router.post("/{conversation_id}/read")
async def mark_read(conversation_id: str, user: CurrentUserDep, conn: DbConn):
    await chat_service.mark_read(conn, conversation_id, user.id)
    return {"ok": True}
