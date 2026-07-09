"""Liveness / info endpoints. Kong strips /api/identity, so these are the
service-root paths (matches README: curl .../api/identity/health)."""
from __future__ import annotations

import time

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])

_STARTED_AT = time.monotonic()


@router.get("/")
def get_info() -> dict:
    return {"service": settings.service_name, "message": "identity-service ready"}


@router.get("/health")
def get_health() -> dict:
    return {
        "service": settings.service_name,
        "status": "ok",
        "uptime": round(time.monotonic() - _STARTED_AT, 3),
    }
