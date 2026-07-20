"""Application settings from environment / .env."""
from __future__ import annotations

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

    postgres_user: str = "charity"
    postgres_password: str = "charity"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    donation_db_name: str = "donation_db"

    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672"
    rabbitmq_exchange: str = "charity.events"

    community_service_url: str = "http://community-service:3002"
    # When true, skip Community HTTP if unreachable (local/dev only)
    community_check_soft: bool = False

    @property
    def database_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.donation_db_name}"
        )


settings = Settings()
