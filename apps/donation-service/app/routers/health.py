from __future__ import annotations

import time

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])
_STARTED = time.monotonic()


@router.get("/")
def root() -> dict:
    return {"service": settings.service_name, "message": "donation-service ready"}


@router.get("/health")
def health() -> dict:
    return {
        "service": settings.service_name,
        "status": "ok",
        "uptime": round(time.monotonic() - _STARTED, 3),
    }
