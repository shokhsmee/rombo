from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Read from env vars prefixed with ROMBO_ (or backend/.env)."""

    model_config = SettingsConfigDict(env_prefix="ROMBO_", env_file=".env", extra="ignore")

    env: str = "dev"
    app_name: str = "Rombo ERP"
    api_prefix: str = "/api/v1"

    database_url: str = "sqlite:///./rombo.db"

    secret_key: str = "dev-only-secret-key-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 720

    cors_origins: list[str] = ["http://localhost:5173"]

    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin12345"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
