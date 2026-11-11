import re
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.config import BACKEND_DIR, Settings
from app.core.ids import new_account_id, new_caller_reference, new_record_id, new_zone_id
from app.core.security import (
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)
from app.db.session import make_engine


def test_password_hash_round_trip_and_salting() -> None:
    first = hash_password("admin123")
    second = hash_password("admin123")

    assert first != second  # unique salt per hash
    assert first.startswith("scrypt$")
    assert verify_password("admin123", first)
    assert not verify_password("wrong", first)


@pytest.mark.parametrize("stored", ["", "plain", "md5$aa$bb", "scrypt$zz$yy", "scrypt$aa"])
def test_verify_password_rejects_malformed_hashes(stored: str) -> None:
    assert verify_password("anything", stored) is False


def test_session_token_is_random_and_only_its_digest_is_stored() -> None:
    token = new_session_token()

    assert token != new_session_token()
    assert len(token) >= 40
    digest = hash_session_token(token)
    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert digest != token
    assert digest == hash_session_token(token)


def test_ids_have_route53_shapes() -> None:
    assert re.fullmatch(r"Z[0-9A-Z]{20}", new_zone_id())
    assert re.fullmatch(r"R[0-9A-Z]{20}", new_record_id())
    assert re.fullmatch(r"[1-9]\d{11}", new_account_id())
    assert new_caller_reference() != new_caller_reference()


def test_relative_sqlite_url_is_anchored_to_backend_dir() -> None:
    settings = Settings(database_url="sqlite:///./data/x.db")
    assert settings.database_url == f"sqlite:///{(BACKEND_DIR / 'data' / 'x.db').resolve()}"


def test_cors_origins_are_split_on_commas() -> None:
    settings = Settings(frontend_origin="http://a.test, https://b.test ,")
    assert settings.cors_origins == ["http://a.test", "https://b.test"]


def test_alembic_migration_matches_models(tmp_path: Path) -> None:
    db_url = f"sqlite:///{tmp_path / 'migrated.db'}"
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", db_url)
    config.attributes["configure_logger"] = False

    command.upgrade(config, "head")
    command.check(config)  # raises if models and migrations have drifted apart

    assert {
        "users",
        "sessions",
        "hosted_zones",
        "vpc_associations",
        "zone_tags",
        "records",
    } <= _table_names(db_url)

    command.downgrade(config, "base")
    assert _table_names(db_url) <= {"alembic_version"}


def _table_names(db_url: str) -> set[str]:
    engine = make_engine(db_url)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_utc_datetime_rejects_naive_values() -> None:
    from datetime import datetime

    from app.db.base import UTCDateTime

    with pytest.raises(ValueError, match="timezone-aware"):
        UTCDateTime().process_bind_param(datetime(2026, 1, 1), dialect=None)  # type: ignore[arg-type]
