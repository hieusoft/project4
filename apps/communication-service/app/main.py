"""FastAPI + Socket.IO entrypoint for communication-service.

Uvicorn target: ``app.main:asgi_app`` (Socket.IO mounted on FastAPI).
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_pool, init_pool
from app.core.exceptions import register_exception_handlers
from app.events.consumer import consumer
from app.realtime.socketio_app import sio
from app.routers import conversations, devices, health, notifications
from app.services import push as push_service
from app.services import reminders as reminder_service

logging.basicConfig(
    level=logging.INFO if settings.node_env == "production" else logging.DEBUG,
    format="%(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(settings.service_name)

_started_at = time.monotonic()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _started_at
    _started_at = time.monotonic()
    try:
        await init_pool()
    except Exception:
        logger.exception("DB pool init failed (will retry on requests)")
    push_service.init_firebase()
    try:
        await consumer.start()
    except Exception:
        logger.exception("Consumer failed to start")
    await reminder_service.start_reminder_loop()
    logger.info(
        "%s started port=%s email=%s push=%s chat=socket.io",
        settings.service_name,
        settings.port,
        "brevo" if settings.brevo_enabled else "logging",
        "fcm" if settings.fcm_enabled else "logging",
    )
    yield
    await reminder_service.stop_reminder_loop()
    await consumer.close()
    await close_pool()
    logger.info("%s stopped", settings.service_name)


api = FastAPI(
    title="communication-service",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    servers=(
        [{"url": settings.openapi_server_url, "description": "Kong gateway"}]
        if settings.openapi_server_url
        else None
    ),
    lifespan=lifespan,
)

api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(api)

api.include_router(health.router)
api.include_router(notifications.router)
api.include_router(devices.router)
api.include_router(conversations.router)


# Patch health uptime to process-ish monotonic from start
@api.get("/health", include_in_schema=False)
async def health_alias():
    return {
        "service": settings.service_name,
        "status": "ok",
        "uptime": time.monotonic() - _started_at,
    }


# ASGI app: Socket.IO at /socket.io + FastAPI routes
asgi_app = socketio.ASGIApp(sio, other_asgi_app=api, socketio_path="socket.io")

# For tools that import `app` (optional)
app = api
