"""HTTP client to community-service (verify group active / moderator role)."""
from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class CommunityClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.community_service_url).rstrip("/")

    async def get_group(
        self, group_id: uuid.UUID, token: str | None = None
    ) -> dict[str, Any] | None:
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"{self.base_url}/groups/{group_id}", headers=headers
                )
        except httpx.HTTPError as e:
            logger.warning("Community unreachable: %s", e)
            if settings.community_check_soft:
                return {"id": str(group_id), "status": "active"}
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Community service unavailable",
            ) from e

        if res.status_code == 404:
            return None
        if res.status_code >= 400:
            logger.warning("Community get_group %s: %s", res.status_code, res.text[:200])
            if settings.community_check_soft:
                return {"id": str(group_id), "status": "active"}
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to verify group with community-service",
            )
        body = res.json()
        return body.get("data", body)

    async def ensure_group_active(
        self, group_id: uuid.UUID, token: str | None = None
    ) -> dict[str, Any]:
        group = await self.get_group(group_id, token)
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Group not found"
            )
        gstatus = group.get("status")
        if gstatus != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Group is not active (status={gstatus})",
            )
        return group

    async def is_group_moderator(
        self, group_id: uuid.UUID, user_id: uuid.UUID, token: str | None = None
    ) -> bool:
        """Best-effort: list members and check role. Soft-fail to True for admin callers handled outside."""
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"{self.base_url}/groups/{group_id}/members",
                    headers=headers,
                    params={"status": "approved", "limit": 100},
                )
        except httpx.HTTPError:
            if settings.community_check_soft:
                return True
            return False

        if res.status_code >= 400:
            if settings.community_check_soft:
                return True
            return False

        body = res.json()
        data = body.get("data", body)
        items = data.get("items", data) if isinstance(data, dict) else data
        if not isinstance(items, list):
            return False
        uid = str(user_id)
        for m in items:
            if str(m.get("user_id")) == uid and m.get("role") in (
                "owner",
                "moderator",
            ):
                return True
        return False


community_client = CommunityClient()
