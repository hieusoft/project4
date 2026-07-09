"""Settings from environment / .env (shared with platform)."""
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
    port: int = 3005
    service_name: str = "communication-service"
    openapi_server_url: str = "/api/communication"

    jwt_secret: str = "change-me"
    jwt_issuer: str = "charity-auth"

    postgres_user: str = "charity"
    postgres_password: str = "charity"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    communication_db_name: str = "communication_db"

    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672"
    rabbitmq_exchange: str = "charity.events"
    communication_events_queue: str = "communication.events"

    frontend_base_url: str = "http://localhost:3000"

    brevo_api_key: str = ""
    brevo_sender_email: str = "noreply@example.com"
    brevo_sender_name: str = "Charity Platform"

    fcm_project_id: str = ""
    fcm_client_email: str = ""
    fcm_private_key: str = ""

    reminder_lead_hours: int = 2
    reminder_interval_seconds: int = 300

    @property
    def database_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.communication_db_name}"
        )

    @property
    def frontend_base(self) -> str:
        return self.frontend_base_url.rstrip("/")

    @property
    def brevo_enabled(self) -> bool:
        return bool(self.brevo_api_key.strip())

    @property
    def fcm_enabled(self) -> bool:
        return bool(
            self.fcm_project_id.strip()
            and self.fcm_client_email.strip()
            and self.fcm_private_key.strip()
        )

    @property
    def fcm_private_key_pem(self) -> str:
        return self.fcm_private_key.replace("\\n", "\n")


settings = Settings()
