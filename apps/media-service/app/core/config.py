"""Application settings loaded from environment / .env.

Reads the same repo-level `.env` as the rest of the platform. R2 credentials
and JWT config are shared; the S3 endpoint is derived from the account id
(Cloudflare R2 endpoints are always https://<account_id>.r2.cloudflarestorage.com).
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Runtime
    node_env: str = "development"
    port: int = 3006
    service_name: str = "media-service"
    # Public URL prefix when behind Kong (Try it out + hub). Empty = relative to host.
    openapi_server_url: str = "/api/media"

    # Auth (shared with identity-service — same secret/issuer signs the JWT)
    jwt_secret: str = "change-me"
    jwt_issuer: str = "charity-auth"

    # PostgreSQL
    postgres_user: str = "charity"
    postgres_password: str = "charity"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    media_db_name: str = "media_db"

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base_url: str = ""

    # Upload limits / lifecycle (defaults — no need to declare in .env)
    presign_expires_seconds: int = 300
    max_file_size_bytes: int = 5 * 1024 * 1024
    temp_ttl_hours: int = 24
    cleanup_interval_minutes: int = 60

    @property
    def database_dsn(self) -> str:
        """Plain PostgreSQL DSN consumed by asyncpg."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.media_db_name}"
        )

    @property
    def r2_endpoint(self) -> str:
        """S3 API endpoint derived from the R2 account id."""
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

    @property
    def r2_public_base(self) -> str:
        """Public CDN base with any trailing slash stripped."""
        return self.r2_public_base_url.rstrip("/")


settings = Settings()
