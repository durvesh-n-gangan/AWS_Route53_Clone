"""Application settings, loaded from environment variables or backend/.env."""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
_SQLITE_PREFIX = "sqlite:///"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Route 53 Clone API"
    database_url: str = f"{_SQLITE_PREFIX}{BACKEND_DIR / 'data' / 'route53.db'}"
    frontend_origin: str = "http://localhost:3000"
    session_ttl_hours: int = 12
    cookie_name: str = "r53_session"
    cookie_secure: bool = False
    seed_on_start: bool = False

    @field_validator("database_url")
    @classmethod
    def _anchor_relative_sqlite_path(cls, value: str) -> str:
        """Resolve `sqlite:///./x.db` against backend/ so the cwd never matters."""
        if not value.startswith(_SQLITE_PREFIX):
            return value
        raw_path = value[len(_SQLITE_PREFIX) :]
        if not raw_path or raw_path == ":memory:" or Path(raw_path).is_absolute():
            return value
        return f"{_SQLITE_PREFIX}{(BACKEND_DIR / raw_path).resolve()}"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
