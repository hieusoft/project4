"""Firebase FCM push (+ logging fallback)."""
from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_app_ready = False


def init_firebase() -> None:
    global _app_ready
    if not settings.fcm_enabled:
        logger.info("FCM disabled (missing credentials) — using dry-run push")
        return
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            cred = credentials.Certificate(
                {
                    "type": "service_account",
                    "project_id": settings.fcm_project_id,
                    "client_email": settings.fcm_client_email,
                    "private_key": settings.fcm_private_key_pem,
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            )
            firebase_admin.initialize_app(cred)
        _app_ready = True
        logger.info("Firebase Admin initialized for FCM")
    except Exception:
        logger.exception("Failed to init Firebase Admin")
        _app_ready = False


async def send_push(
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> None:
    if not tokens:
        return
    if not _app_ready:
        logger.info(
            "[dry-run FCM] tokens=%s title=%s body=%s", len(tokens), title, body
        )
        return

    from firebase_admin import messaging

    # FCM multicast max 500
    for i in range(0, len(tokens), 500):
        chunk = tokens[i : i + 500]
        message = messaging.MulticastMessage(
            tokens=chunk,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
        )
        response = messaging.send_each_for_multicast(message)
        if response.failure_count:
            logger.warning(
                "FCM partial failure: %s/%s", response.failure_count, len(chunk)
            )
        else:
            logger.info("FCM sent to %s device(s): %s", len(chunk), title)
