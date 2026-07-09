"""Private TOTP 2FA management endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.core.deps import CurrentUserDep
from app.schemas.common import DataEnvelope, MessageResponse
from app.schemas.two_factor import TwoFactorCodeRequest, TwoFactorSetupResponse
from app.services.providers import TwoFactorServiceDep

router = APIRouter(prefix="/auth/2fa", tags=["two-factor"])


@router.post("/setup", response_model=DataEnvelope[TwoFactorSetupResponse])
async def setup(
    user: CurrentUserDep,
    two_factor: TwoFactorServiceDep,
):
    result = await two_factor.setup_by_id(uuid.UUID(user.id))
    return DataEnvelope(data=result)


@router.post("/enable", response_model=DataEnvelope[MessageResponse])
async def enable(
    body: TwoFactorCodeRequest,
    user: CurrentUserDep,
    two_factor: TwoFactorServiceDep,
):
    await two_factor.enable(uuid.UUID(user.id), body.code)
    return DataEnvelope(data=MessageResponse(message="2FA enabled"))


@router.post("/disable", response_model=DataEnvelope[MessageResponse])
async def disable(
    body: TwoFactorCodeRequest,
    user: CurrentUserDep,
    two_factor: TwoFactorServiceDep,
):
    await two_factor.disable(uuid.UUID(user.id), body.code)
    return DataEnvelope(data=MessageResponse(message="2FA disabled"))
