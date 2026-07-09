"""Profile read/update + activity log listing."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from app.models.domain import UserActivityLog, UserProfile
from app.repositories.activity import ActivityRepository
from app.repositories.profile import ProfileRepository
from app.schemas.profile import ProfileUpdateRequest


class ProfileService:
    def __init__(
        self,
        profiles: ProfileRepository,
        activity: ActivityRepository,
    ) -> None:
        self._profiles = profiles
        self._activity = activity

    async def get(self, account_id: uuid.UUID) -> UserProfile:
        profile = await self._profiles.get_by_id(account_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
            )
        return profile

    async def update(
        self, account_id: uuid.UUID, data: ProfileUpdateRequest
    ) -> UserProfile:
        # Only send fields the client actually provided.
        fields = data.model_dump(exclude_unset=True)
        profile = await self._profiles.update(account_id, fields)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
            )
        return profile

    async def list_activities(
        self, account_id: uuid.UUID, *, limit: int, offset: int
    ) -> tuple[list[UserActivityLog], int]:
        return await self._activity.list_for_user(
            account_id, limit=limit, offset=offset
        )
