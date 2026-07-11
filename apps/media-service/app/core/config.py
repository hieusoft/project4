"""Application settings loaded from environment / .env.

Reads the same repo-level `.env` as the rest of the platform. Object storage
is SeaweedFS (S3-compatible gateway) running in Docker — not cloud R2.
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

    # SeaweedFS (S3-compatible) — self-hosted object storage
    # Internal endpoint used by media-service (Docker service name).
    seaweed_s3_endpoint: str = "http://seaweedfs:8333"
    # Host browsers use for presigned PUT / public GET. Defaults to endpoint
    # if empty; in Docker set to http://localhost:8333 (or your public host).
    seaweed_s3_public_endpoint: str = "http://localhost:8333"
    seaweed_access_key_id: str = "seaweed"
    seaweed_secret_access_key: str = "seaweed"
    seaweed_bucket: str = "media"
    # Public base for stored public_url: typically {public_endpoint}/{bucket}
    seaweed_public_base_url: str = "http://localhost:8333/media"
    seaweed_s3_region: str = "us-east-1"

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
    def seaweed_public_base(self) -> str:
        """Public object URL base with any trailing slash stripped."""
        return self.seaweed_public_base_url.rstrip("/")


settings = Settings()
