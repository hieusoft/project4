"""Media business logic: presign, confirm, link, unlink, get.

Ownership model: the JWT subject (owner_id) owns the media it presigns. Only
the owner may confirm/link/unlink; admins may additionally read any media.
Object keys are generated server-side (never trust the client filename).
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from app.core.config import settings
from app.models.domain import MediaFile
from app.models.enums import MediaStatus
from app.repositories.media import MediaRepository
from app.schemas.media import PresignResponse
from app.services import r2


class MediaService:
    def __init__(self, media: MediaRepository) -> None:
        self._media = media

    # --- Presign ----------------------------------------------------------
    async def presign(
        self,
        *,
        owner_id: uuid.UUID,
        mime_type: str,
        ref_type: str,
        file_size: int,
    ) -> PresignResponse:
        if file_size > settings.max_file_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File exceeds max allowed size",
            )
        object_key = r2.generate_object_key(ref_type, mime_type)
        public_url = r2.public_url(object_key)

        media = await self._media.create_temp(
            owner_id=owner_id,
            bucket_key=object_key,
            public_url=public_url,
            mime_type=mime_type,
            size_bytes=file_size,
            ref_type=ref_type,
        )
        upload_url = r2.create_presigned_put_url(object_key, mime_type)
        return PresignResponse(
            media_id=media.id,
            upload_url=upload_url,
            bucket_key=object_key,
            public_url=public_url,
            headers={"Content-Type": mime_type},
            expires_in=settings.presign_expires_seconds,
        )

    # --- Confirm ----------------------------------------------------------
    async def confirm(
        self, *, media_id: uuid.UUID, owner_id: uuid.UUID
    ) -> MediaFile:
        media = await self._require_owned(media_id, owner_id)
        exists = await r2.object_exists(media.bucket_key)
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Object not uploaded to R2 yet",
            )
        return media

    # --- Link (called by business services after creating an entity) ------
    async def link(
        self,
        *,
        media_ids: list[uuid.UUID],
        ref_type: str,
        ref_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> list[MediaFile]:
        found = await self._media.get_many(media_ids)
        self._assert_all_present_and_owned(media_ids, found, owner_id)

        for media in found:
            already = (
                media.status == MediaStatus.linked
                and media.ref_type == ref_type
                and media.ref_id == ref_id
            )
            if not already:
                await self._media.mark_linked(
                    media.id, ref_type=ref_type, ref_id=ref_id
                )
        return await self._media.get_many(media_ids)

    # --- Unlink -----------------------------------------------------------
    async def unlink(
        self, *, media_ids: list[uuid.UUID], owner_id: uuid.UUID
    ) -> list[MediaFile]:
        found = await self._media.get_many(media_ids)
        self._assert_all_present_and_owned(media_ids, found, owner_id)

        for media in found:
            if media.status != MediaStatus.temp:
                await self._media.mark_temp(media.id)
        return await self._media.get_many(media_ids)

    # --- Get --------------------------------------------------------------
    async def get(
        self, *, media_id: uuid.UUID, requester_id: uuid.UUID, is_admin: bool
    ) -> MediaFile:
        media = await self._media.get_by_id(media_id)
        if media is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Media not found"
            )
        if not is_admin and media.owner_id != requester_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner"
            )
        return media

    # --- Helpers ----------------------------------------------------------
    async def _require_owned(
        self, media_id: uuid.UUID, owner_id: uuid.UUID
    ) -> MediaFile:
        media = await self._media.get_by_id(media_id)
        if media is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Media not found"
            )
        if media.owner_id != owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner"
            )
        return media

    @staticmethod
    def _assert_all_present_and_owned(
        requested: list[uuid.UUID],
        found: list[MediaFile],
        owner_id: uuid.UUID,
    ) -> None:
        by_id = {m.id: m for m in found}
        for media_id in requested:
            media = by_id.get(media_id)
            if media is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Media not found: {media_id}",
                )
            if media.owner_id != owner_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Not the owner of media: {media_id}",
                )
