"""Request/response schemas for the auth flows."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _email_or_phone(self) -> "RegisterRequest":
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")
        return self


class VerifyEmailRequest(BaseModel):
    """Email + 6-digit OTP from verification email (no magic-link token)."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    username: str | None = Field(default=None, max_length=30)
    password: str = Field(min_length=1, max_length=128)
    device_info: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _email_or_phone_or_username(self) -> "LoginRequest":
        if not self.email and not self.phone and not self.username:
            raise ValueError("Either email, phone, or username is required")
        return self


class TwoFactorLoginRequest(BaseModel):
    challenge_token: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=10)
    device_info: str | None = Field(default=None, max_length=255)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)
    device_info: str | None = Field(default=None, max_length=255)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    """Step 2: check OTP before showing the new-password form."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerifyResetCodeResponse(BaseModel):
    """Client stores reset_token and sends it with the new password."""

    reset_token: str
    expires_in: int  # seconds
    token_type: str = "Bearer"


class ResetPasswordRequest(BaseModel):
    """Step 3: set new password after OTP was checked.

    Prefer ``reset_token`` from ``/verify-reset-code``.
    One-shot ``email`` + ``code`` + ``new_password`` still accepted.
    """

    new_password: str = Field(min_length=8, max_length=128)
    reset_token: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    code: str | None = Field(default=None, min_length=6, max_length=6, pattern=r"^\d{6}$")

    @model_validator(mode="after")
    def _token_or_code(self) -> "ResetPasswordRequest":
        if self.reset_token:
            return self
        if self.email and self.code:
            return self
        raise ValueError("Provide reset_token, or email + code")
