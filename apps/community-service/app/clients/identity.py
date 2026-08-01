"""HTTP client to identity-service (batch profile lookup for post authors)."""
from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# identity `/profile/batch` nhận danh sách id qua query string; chia nhỏ để
# URL không vượt giới hạn của gateway.
_BATCH_SIZE = 50


class IdentityClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.identity_service_url).rstrip("/")

    async def get_profiles(
        self, account_ids: list[uuid.UUID]
    ) -> dict[str, dict[str, Any]]:
        """Nạp hồ sơ công khai của nhiều tài khoản, trả về map theo id.

        Lỗi mạng/service không được làm hỏng lời gọi: trả về map rỗng để
        caller hiển thị nội dung mà không có tên tác giả.
        """
        unique = list({str(i) for i in account_ids})
        if not unique:
            return {}

        out: dict[str, dict[str, Any]] = {}
        try:
            async with httpx.AsyncClient(
                timeout=settings.identity_timeout_seconds
            ) as client:
                for start in range(0, len(unique), _BATCH_SIZE):
                    chunk = unique[start : start + _BATCH_SIZE]
                    res = await client.get(
                        f"{self.base_url}/profile/batch",
                        params={"ids": ",".join(chunk)},
                    )
                    if res.status_code >= 400:
                        logger.warning(
                            "Identity get_profiles %s: %s",
                            res.status_code,
                            res.text[:200],
                        )
                        continue
                    body = res.json()
                    for item in body.get("data", body) or []:
                        if isinstance(item, dict) and item.get("id"):
                            out[str(item["id"])] = item
        except httpx.HTTPError as e:
            logger.warning("Identity unreachable: %s", e)
            return out
        return out


identity_client = IdentityClient()
