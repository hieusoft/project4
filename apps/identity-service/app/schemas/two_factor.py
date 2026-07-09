"""Two-factor (TOTP) schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class TwoFactorCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=10)
