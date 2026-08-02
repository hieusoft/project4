"""Application settings from environment / .env."""
from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    node_env: str = "development"
    port: int = 3003
    service_name: str = "donation-service"
    openapi_server_url: str = "/api/donation"

    jwt_secret: str = "change-me"
    jwt_issuer: str = "charity-auth"

    # CORS — comma-separated origins ("*" allows all, but disables credentials)
    cors_origins: str = "*"

    postgres_user: str = "charity"
    postgres_password: str = "charity"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    donation_db_name: str = "donation_db"

    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672"
    rabbitmq_exchange: str = "charity.events"

    community_service_url: str = "http://community-service:3002"
    identity_service_url: str = "http://identity-service:3001"
    # When true, skip Community HTTP if unreachable (local/dev only)
    community_check_soft: bool = False

    @property
    def database_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.donation_db_name}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_allow_credentials(self) -> bool:
        return "*" not in self.cors_origins_list

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        if self.node_env == "production" and self.jwt_secret in ("change-me", ""):
            raise ValueError(
                "JWT_SECRET must be set to a strong value in production "
                "(run: openssl rand -hex 32)."
            )
        return self


settings = Settings()
