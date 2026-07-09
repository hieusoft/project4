from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    return {
        "service": settings.service_name,
        "message": "communication-service ready",
        "channels": {
            "email": "brevo" if settings.brevo_enabled else "logging",
            "push": "fcm" if settings.fcm_enabled else "logging",
            "chat": "socket.io",
        },
    }


@router.get("/health")
async def health():
    import time

    return {
        "service": settings.service_name,
        "status": "ok",
        "uptime": time.monotonic(),
    }
