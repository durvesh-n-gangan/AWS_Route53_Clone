"""Shared fixtures: a fresh in-memory SQLite database and an app wired to it per test."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401  (registers every table)
from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db, make_engine, make_session_factory
from app.main import create_app
from app.models import User


@pytest.fixture
def engine() -> Iterator[Engine]:
    test_engine = make_engine("sqlite://")
    Base.metadata.create_all(test_engine)
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return make_session_factory(engine)


@pytest.fixture
def db(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    with session_factory() as session:
        yield session


@pytest.fixture
def settings() -> Settings:
    return Settings(database_url="sqlite://", frontend_origin="http://localhost:3000")


@pytest.fixture
def app(settings: Settings, session_factory: sessionmaker[Session]) -> FastAPI:
    application = create_app(settings)

    def _override_get_db() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    application.dependency_overrides[get_db] = _override_get_db
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # raise_server_exceptions=False lets us assert on the 500 response body.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


DEMO_USERNAME = "admin"
DEMO_PASSWORD = "admin123"


@pytest.fixture
def user(db: Session) -> User:
    account = User(
        username=DEMO_USERNAME,
        password_hash=hash_password(DEMO_PASSWORD),
        account_id="123456789012",
    )
    db.add(account)
    db.commit()
    return account


@pytest.fixture
def auth_client(client: TestClient, user: User) -> TestClient:
    """A client that is already signed in as the demo user."""
    response = client.post(
        "/api/v1/auth/login", json={"username": DEMO_USERNAME, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return client
