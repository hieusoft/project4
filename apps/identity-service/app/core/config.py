"""Application settings loaded from environment / .env.

Mirrors the variables already declared in the repo-level `.env` / `.env.example`
so the identity-service reads the same config as the rest of the platform.
"""
from __future__ import annotations

import re

from pydantic_settings import BaseSettings, SettingsConfigDict

_DURATION_RE = re.compile(r"^\s*(\d+)\s*([smhd])?\s*$")
_UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_duration_seconds(value: str, default_unit: str = "s") -> int:
    """Parse durations like ``15m``, ``7d``, ``3600`` into seconds."""
    match = _DURATION_RE.match(str(value))
    if not match:
        raise ValueError(f"Invalid duration: {value!r}")
    amount, unit = match.group(1), match.group(2) or default_unit
    return int(amount) * _UNIT_SECONDS[unit]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Runtime
    node_env: str = "development"
    port: int = 3001
    service_name: str = "identity-service"
    # Public URL prefix when behind Kong (Try it out + hub). Empty = relative to host.
    openapi_server_url: str = "/api/identity"

    # Auth / tokens
    jwt_secret: str = "change-me"
    jwt_issuer: str = "charity-auth"
    access_token_ttl: str = "15m"
    refresh_token_ttl: str = "7d"
    two_factor_challenge_ttl: str = "5m"
    totp_issuer: str = "charity-auth"
    email_verification_expiry_hours: int = 24
    password_reset_expiry_hours: int = 1

    # PostgreSQL
    postgres_user: str = "charity"
    postgres_password: str = "charity"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    identity_db_name: str = "identity_db"

    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672"
    rabbitmq_exchange: str = "charity.events"

    # Frontend (for building verification / reset links in events)
    frontend_base_url: str = "http://localhost:3000"

    @property
    def database_dsn(self) -> str:
        """Plain PostgreSQL DSN consumed by asyncpg."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.identity_db_name}"
        )

    @property
    def access_token_ttl_seconds(self) -> int:
        return parse_duration_seconds(self.access_token_ttl, default_unit="m")

    @property
    def refresh_token_ttl_seconds(self) -> int:
        return parse_duration_seconds(self.refresh_token_ttl, default_unit="d")

    @property
    def two_factor_challenge_ttl_seconds(self) -> int:
        return parse_duration_seconds(self.two_factor_challenge_ttl, default_unit="m")


settings = Settings()
