"""Admin account management endpoints (PLATFORM_ADMIN only)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_roles
from app.models.enums import AccountStatus
from app.schemas.account import AccountSummary
from app.schemas.common import DataEnvelope, Paginated, PaginationMeta
from app.services.providers import AccountServiceDep

router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
    dependencies=[Depends(require_roles("PLATFORM_ADMIN"))],
)


@router.get("", response_model=DataEnvelope[Paginated[AccountSummary]])
async def list_accounts(
    service: AccountServiceDep,
    status_filter: AccountStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    offset = (page - 1) * limit
    accounts, total = await service.list_accounts(
        status_filter=status_filter, limit=limit, offset=offset
    )
    return DataEnvelope(
        data=Paginated(
            items=[AccountSummary.model_validate(a) for a in accounts],
            meta=PaginationMeta(page=page, limit=limit, total=total),
        )
    )


@router.post("/{account_id}/lock", response_model=DataEnvelope[AccountSummary])
async def lock_account(account_id: uuid.UUID, service: AccountServiceDep):
    account = await service.lock(account_id)
    return DataEnvelope(data=AccountSummary.model_validate(account))


@router.post("/{account_id}/unlock", response_model=DataEnvelope[AccountSummary])
async def unlock_account(account_id: uuid.UUID, service: AccountServiceDep):
    account = await service.unlock(account_id)
    return DataEnvelope(data=AccountSummary.model_validate(account))
