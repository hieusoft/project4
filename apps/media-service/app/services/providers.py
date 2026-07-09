"""FastAPI dependency providers assembling repositories + services."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.deps import DbConn
from app.repositories.media import MediaRepository
from app.services.media_service import MediaService


def get_media_service(conn: DbConn) -> MediaService:
    return MediaService(MediaRepository(conn))


MediaServiceDep = Annotated[MediaService, Depends(get_media_service)]
