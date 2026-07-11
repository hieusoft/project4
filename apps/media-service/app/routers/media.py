"""Media endpoints. Paths are relative to the service root; Kong strips the
/api/media prefix before forwarding.

Success responses use the { "data": ... } envelope to match the platform's
TransformInterceptor.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.deps import ADMIN_ROLES, CurrentUserDep
from app.schemas.common import DataEnvelope
from app.schemas.media import (
    MIME_EXT,
    ConfirmRequest,
    LinkRequest,
    MediaOut,
    PresignRequest,
    PresignResponse,
    UnlinkRequest,
)
from app.services.providers import MediaServiceDep

# No prefix: Kong strips /api/media, so endpoints sit at the service root
# (/presign, /confirm, /link, /unlink, /{media_id}) matching docs/flows.md.
router = APIRouter(tags=["media"])


@router.post(
    "/presign",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[PresignResponse],
)
async def presign(
    body: PresignRequest, user: CurrentUserDep, service: MediaServiceDep
):
    result = await service.presign(
        owner_id=uuid.UUID(user.id),
        mime_type=body.mime_type,
        ref_type=body.ref_type,
        file_size=body.file_size,
    )
    return DataEnvelope(data=result)


@router.post(
    "/files/upload",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[MediaOut],
    summary="Proxy upload (multipart) — preferred for Flutter Web",
)
async def upload(
    user: CurrentUserDep,
    service: MediaServiceDep,
    file: UploadFile = File(...),
    ref_type: str = Form(default="avatar"),
):
    """Browser clients often cannot PUT directly to SeaweedFS S3 (CORS).

    Path is ``/files/upload`` (not ``/upload``) so it never collides with
    ``GET /{media_id}`` which would otherwise return HTTP 405.

    This endpoint accepts the file, streams it to SeaweedFS server-side, and
    returns media metadata including ``public_url``.
    """
    raw = await file.read()
    mime_type = (file.content_type or "image/jpeg").split(";")[0].strip().lower()
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"
    if mime_type not in MIME_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported mime_type: {mime_type}. Allowed: {list(MIME_EXT)}",
        )
    if ref_type not in (
        "donation",
        "listing",
        "post",
        "avatar",
        "chat",
        "delivery",
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported ref_type: {ref_type}",
        )

    media = await service.upload_bytes(
        owner_id=uuid.UUID(user.id),
        mime_type=mime_type,
        ref_type=ref_type,
        body=raw,
    )
    return DataEnvelope(data=MediaOut.model_validate(media, from_attributes=True))


@router.post("/confirm", response_model=DataEnvelope[MediaOut])
async def confirm(
    body: ConfirmRequest, user: CurrentUserDep, service: MediaServiceDep
):
    media = await service.confirm(media_id=body.media_id, owner_id=uuid.UUID(user.id))
    return DataEnvelope(data=MediaOut.model_validate(media, from_attributes=True))


@router.put("/link", response_model=DataEnvelope[list[MediaOut]])
async def link(body: LinkRequest, user: CurrentUserDep, service: MediaServiceDep):
    media = await service.link(
        media_ids=body.media_ids,
        ref_type=body.ref_type,
        ref_id=body.ref_id,
        owner_id=uuid.UUID(user.id),
    )
    return DataEnvelope(
        data=[MediaOut.model_validate(m, from_attributes=True) for m in media]
    )


@router.put("/unlink", response_model=DataEnvelope[list[MediaOut]])
async def unlink(body: UnlinkRequest, user: CurrentUserDep, service: MediaServiceDep):
    media = await service.unlink(
        media_ids=body.media_ids, owner_id=uuid.UUID(user.id)
    )
    return DataEnvelope(
        data=[MediaOut.model_validate(m, from_attributes=True) for m in media]
    )


@router.get("/{media_id}", response_model=DataEnvelope[MediaOut])
async def get_media(
    media_id: uuid.UUID, user: CurrentUserDep, service: MediaServiceDep
):
    is_admin = any(role in ADMIN_ROLES for role in user.roles)
    media = await service.get(
        media_id=media_id, requester_id=uuid.UUID(user.id), is_admin=is_admin
    )
    return DataEnvelope(data=MediaOut.model_validate(media, from_attributes=True))
