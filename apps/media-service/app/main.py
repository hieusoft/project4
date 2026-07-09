"""FastAPI application entry point.

Wires the asyncpg pool, the temp-media cleanup cron (a background asyncio
task), routers, and the NestJS-compatible exception envelope.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_pool, init_pool
from app.core.exceptions import register_exception_handlers
from app.routers import health, media
from app.services.cleanup import cleanup_expired_temp, run_cleanup_loop

logging.basicConfig(
    level=logging.INFO if settings.node_env == "production" else logging.DEBUG,
    format="%(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(settings.service_name)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup
    await init_pool()
    # One sweep at startup to clear leftovers, then the periodic loop.
    try:
        await cleanup_expired_temp()
    except Exception:
        logger.exception("initial cleanup sweep failed")
    cleanup_task = asyncio.create_task(run_cleanup_loop())
    logger.info("%s started on port %s", settings.service_name, settings.port)

    yield

    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    await close_pool()
    logger.info("%s stopped", settings.service_name)


app = FastAPI(
    title="media-service",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Permissive CORS to match the NestJS services' app.enableCors().
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(media.router)
