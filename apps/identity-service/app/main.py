"""FastAPI application entry point.

Wires the asyncpg pool, RabbitMQ publisher/consumer (opened/closed via the
lifespan), routers, and the NestJS-compatible exception envelope.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import close_pool, init_pool
from app.core.exceptions import register_exception_handlers
from app.events.consumer import consumer
from app.events.publisher import publisher
from app.routers import accounts, auth, health, profile, two_factor

logging.basicConfig(
    level=logging.INFO if settings.node_env == "production" else logging.DEBUG,
    format="%(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(settings.service_name)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup
    await init_pool()
    try:
        await publisher.connect()
    except Exception:
        logger.exception("Publisher failed to connect (events will be dropped)")
    try:
        await consumer.start()
    except Exception:
        logger.exception("Consumer failed to start")
    logger.info("%s started on port %s", settings.service_name, settings.port)

    yield

    # Shutdown
    await consumer.close()
    await publisher.close()
    await close_pool()
    logger.info("%s stopped", settings.service_name)


app = FastAPI(
    title="identity-service",
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
app.include_router(auth.router)
app.include_router(two_factor.router)
app.include_router(profile.router)
app.include_router(accounts.router)
