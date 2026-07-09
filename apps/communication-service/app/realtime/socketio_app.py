"""Socket.IO server for realtime chat.

Client (via Kong):
  io(gateway, { path: '/api/communication/socket.io', auth: { token: accessJwt } })

Client (direct):
  io('http://localhost:3005', { path: '/socket.io', auth: { token: accessJwt } })
"""
from __future__ import annotations

import logging
from typing import Any

import jwt
import socketio

from app.core.database import get_pool
from app.core.security import decode_token
from app.services import chat as chat_service

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


def _extract_token(auth: Any, environ: dict) -> str | None:
    if isinstance(auth, dict) and auth.get("token"):
        return str(auth["token"])
    # query string token
    qs = environ.get("QUERY_STRING") or ""
    for part in qs.split("&"):
        if part.startswith("token="):
            return part.split("=", 1)[1]
    return None


@sio.event
async def connect(sid: str, environ: dict, auth: Any = None) -> bool:
    token = _extract_token(auth, environ)
    # Also try Authorization header via ASGI scope if present
    if not token:
        headers = environ.get("HTTP_AUTHORIZATION") or environ.get("asgi.scope", {}).get(
            "headers"
        )
        if isinstance(headers, str) and headers.lower().startswith("bearer "):
            token = headers[7:]
    if not token:
        logger.info("Socket reject %s: missing token", sid)
        return False
    try:
        payload = decode_token(token, expected_type="access")
        user_id = str(payload.get("sub") or "")
        if not user_id:
            return False
        await sio.save_session(sid, {"user_id": user_id})
        await sio.enter_room(sid, f"user:{user_id}")
        logger.debug("Socket connected sid=%s user=%s", sid, user_id)
        return True
    except jwt.InvalidTokenError:
        logger.info("Socket reject %s: invalid token", sid)
        return False


@sio.event
async def disconnect(sid: str) -> None:
    logger.debug("Socket disconnected %s", sid)


@sio.event
async def join_conversation(sid: str, data: dict[str, Any] | None = None) -> dict:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    conversation_id = (data or {}).get("conversationId")
    if not user_id or not conversation_id:
        return {"ok": False, "error": "conversationId required"}
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await chat_service.list_messages(
                    conn, str(conversation_id), user_id, limit=1, offset=0
                )
        await sio.enter_room(sid, f"conversation:{conversation_id}")
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@sio.event
async def leave_conversation(sid: str, data: dict[str, Any] | None = None) -> dict:
    conversation_id = (data or {}).get("conversationId")
    if conversation_id:
        await sio.leave_room(sid, f"conversation:{conversation_id}")
    return {"ok": True}


@sio.event
async def send_message(sid: str, data: dict[str, Any] | None = None) -> dict:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    data = data or {}
    conversation_id = data.get("conversationId")
    content = data.get("content")
    if not user_id or not conversation_id or not content:
        return {"ok": False, "error": "conversationId and content required"}
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                message = await chat_service.send_message(
                    conn,
                    conversation_id=str(conversation_id),
                    sender_id=user_id,
                    content=str(content),
                    type_=str(data.get("type") or "text"),
                    as_group=bool(data.get("asGroup")),
                )
        # Serialize datetime for JSON
        payload = _jsonable(message)
        await sio.emit(
            "new_message",
            payload,
            room=f"conversation:{conversation_id}",
        )
        return {"ok": True, "message": payload}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@sio.event
async def mark_read(sid: str, data: dict[str, Any] | None = None) -> dict:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    conversation_id = (data or {}).get("conversationId")
    if not user_id or not conversation_id:
        return {"ok": False, "error": "conversationId required"}
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await chat_service.mark_read(conn, str(conversation_id), user_id)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def emit_new_message(conversation_id: str, message: dict[str, Any]) -> None:
    await sio.emit(
        "new_message",
        _jsonable(message),
        room=f"conversation:{conversation_id}",
    )


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonable(v) for v in obj]
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "hex"):  # uuid
        return str(obj)
    return obj
