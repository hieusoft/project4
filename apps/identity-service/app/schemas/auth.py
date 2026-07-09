"""Request/response schemas for the auth flows."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
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
    token: str = Field(min_length=1)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=1, max_length=128)
    device_info: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _email_or_phone(self) -> "LoginRequest":
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")
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


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
