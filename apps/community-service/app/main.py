"""FastAPI entrypoint for community-service."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_pool, init_pool
from app.core.exceptions import register_exception_handlers
from app.events.publisher import publisher
from app.routers import groups, health, posts

logging.basicConfig(
    level=logging.INFO if settings.node_env == "production" else logging.DEBUG,
    format="%(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(settings.service_name)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_pool()
    try:
        await publisher.connect()
    except Exception:
        logger.exception("Publisher failed to connect")
    logger.info("%s started on port %s", settings.service_name, settings.port)
    yield
    await publisher.close()
    await close_pool()
    logger.info("%s stopped", settings.service_name)


_openapi_servers = (
    [{"url": settings.openapi_server_url, "description": "Kong gateway"}]
    if settings.openapi_server_url
    else None
)

app = FastAPI(
    title="community-service",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    servers=_openapi_servers,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(groups.router)
app.include_router(posts.router)
