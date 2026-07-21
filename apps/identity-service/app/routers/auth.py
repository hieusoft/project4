"""Public auth endpoints. Paths are relative to the service root; Kong strips
the /api/identity prefix before forwarding."""
from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.account import MeResponse
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TwoFactorLoginRequest,
    VerifyEmailRequest,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.schemas.common import DataEnvelope, MessageResponse
from app.schemas.token import TokenPair, TwoFactorChallenge
from app.services.providers import AuthServiceDep

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=DataEnvelope[MeResponse],
)
async def register(body: RegisterRequest, service: AuthServiceDep):
    account = await service.register(body)
    return DataEnvelope(
        data=MeResponse(
            id=account.id,
            username=account.username,
            email=account.email,
            phone=account.phone,
            status=account.status,
            email_verified=account.email_verified,
            totp_enabled=account.totp_enabled,
            roles=["USER"],
        )
    )


@router.post("/verify-email", response_model=DataEnvelope[MessageResponse])
async def verify_email(body: VerifyEmailRequest, service: AuthServiceDep):
    await service.verify_email(email=body.email, code=body.code)
    return DataEnvelope(data=MessageResponse(message="Email verified"))


@router.post("/resend-verification", response_model=DataEnvelope[MessageResponse])
async def resend_verification(
    body: ResendVerificationRequest, service: AuthServiceDep
):
    await service.resend_verification(body.email)
    # Always 200 to avoid leaking whether the email exists.
    return DataEnvelope(
        data=MessageResponse(message="If the email exists, a verification code was sent")
    )


@router.post("/login")
async def login(body: LoginRequest, service: AuthServiceDep):
    result = await service.login(body)
    # Either a token pair or a 2FA challenge — wrap both in the data envelope.
    return {"data": result}


@router.post("/login/2fa", response_model=DataEnvelope[TokenPair])
async def login_two_factor(body: TwoFactorLoginRequest, service: AuthServiceDep):
    pair = await service.login_two_factor(
        challenge_token=body.challenge_token,
        code=body.code,
        device_info=body.device_info,
    )
    return DataEnvelope(data=pair)


@router.post("/refresh", response_model=DataEnvelope[TokenPair])
async def refresh(body: RefreshRequest, service: AuthServiceDep):
    pair = await service.refresh(
        raw_refresh_token=body.refresh_token, device_info=body.device_info
    )
    return DataEnvelope(data=pair)


@router.post("/logout", response_model=DataEnvelope[MessageResponse])
async def logout(body: LogoutRequest, service: AuthServiceDep):
    await service.logout(body.refresh_token)
    return DataEnvelope(data=MessageResponse(message="Logged out"))


@router.post("/forgot-password", response_model=DataEnvelope[MessageResponse])
async def forgot_password(body: ForgotPasswordRequest, service: AuthServiceDep):
    """Step 1 — send 6-digit code to email (always 200)."""
    await service.forgot_password(body.email)
    return DataEnvelope(
        data=MessageResponse(message="If the email exists, a reset code was sent")
    )


@router.post(
    "/verify-reset-code",
    response_model=DataEnvelope[VerifyResetCodeResponse],
)
async def verify_reset_code(
    body: VerifyResetCodeRequest, service: AuthServiceDep
):
    """Step 2 — check OTP, return short-lived reset_token for password form."""
    result = await service.verify_reset_code(email=body.email, code=body.code)
    return DataEnvelope(data=result)


@router.post("/reset-password", response_model=DataEnvelope[MessageResponse])
async def reset_password(body: ResetPasswordRequest, service: AuthServiceDep):
    """Step 3 — set new password (prefer reset_token from step 2)."""
    await service.reset_password(body)
    return DataEnvelope(data=MessageResponse(message="Password reset successful"))
