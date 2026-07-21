"""Profile endpoints: own profile read/update, public profile, activity log."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.core.deps import CurrentUserDep
from app.schemas.common import DataEnvelope, Paginated, PaginationMeta
from app.schemas.profile import (
    ActivityLogItem,
    ProfilePrivate,
    ProfilePublic,
    ProfileUpdateRequest,
)
from app.services.providers import ProfileServiceDep

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=DataEnvelope[ProfilePrivate])
async def get_my_profile(user: CurrentUserDep, service: ProfileServiceDep):
    data = await service.get_public(uuid.UUID(user.id))
    return DataEnvelope(data=ProfilePrivate.model_validate(data))


@router.put("/me", response_model=DataEnvelope[ProfilePrivate])
async def update_my_profile(
    body: ProfileUpdateRequest,
    user: CurrentUserDep,
    service: ProfileServiceDep,
):
    await service.update(uuid.UUID(user.id), body)
    data = await service.get_public(uuid.UUID(user.id))
    return DataEnvelope(data=ProfilePrivate.model_validate(data))


@router.get("/me/activities", response_model=DataEnvelope[Paginated[ActivityLogItem]])
async def list_my_activities(
    user: CurrentUserDep,
    service: ProfileServiceDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    offset = (page - 1) * limit
    items, total = await service.list_activities(
        uuid.UUID(user.id), limit=limit, offset=offset
    )
    return DataEnvelope(
        data=Paginated(
            items=[ActivityLogItem.model_validate(i) for i in items],
            meta=PaginationMeta(page=page, limit=limit, total=total),
        )
    )


@router.get("/{account_id}", response_model=DataEnvelope[ProfilePublic])
async def get_public_profile(account_id: uuid.UUID, service: ProfileServiceDep):
    data = await service.get_public(account_id)
    return DataEnvelope(data=ProfilePublic.model_validate(data))
