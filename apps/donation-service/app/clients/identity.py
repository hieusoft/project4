"""HTTP client to identity-service (public profile lookup)."""
from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class IdentityClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.identity_service_url).rstrip("/")

    async def get_public_profile(
        self, account_id: uuid.UUID
    ) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    f"{self.base_url}/profile/{account_id}"
                )
        except httpx.HTTPError as e:
            logger.warning("Identity unreachable: %s", e)
            return None

        if res.status_code == 404:
            return None
        if res.status_code >= 400:
            logger.warning(
                "Identity get_public_profile %s: %s", res.status_code, res.text[:200]
            )
            return None
        body = res.json()
        return body.get("data", body)


identity_client = IdentityClient()
