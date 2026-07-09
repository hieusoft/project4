"""Token response schemas."""
from __future__ import annotations

from pydantic import BaseModel


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int  # access token lifetime in seconds


class TwoFactorChallenge(BaseModel):
    """Returned by /auth/login when the account has TOTP enabled."""

    two_factor_required: bool = True
    challenge_token: str
