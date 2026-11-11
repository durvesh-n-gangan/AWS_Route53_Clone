"""Every failure must come back as {"error": {"code", "message", "details"}}."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import AppError


@pytest.fixture
def probe_app(app: FastAPI) -> FastAPI:
    @app.get("/_probe/validate")
    def _validate(count: int) -> dict[str, int]:
        return {"count": count}

    @app.get("/_probe/app-error")
    def _app_error() -> None:
        raise AppError(
            "HostedZoneNotEmpty", "Zone is not empty.", 409, details={"hosted_zone_id": "Z1"}
        )

    @app.get("/_probe/crash")
    def _crash() -> None:
        raise RuntimeError("secret internal detail")

    return app


def _assert_error_shape(body: dict) -> dict:
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    return body["error"]


def test_unknown_route_returns_404_in_error_format(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    error = _assert_error_shape(response.json())
    assert error["code"] == "NotFound"


def test_wrong_method_returns_405_in_error_format(client: TestClient) -> None:
    response = client.post("/api/v1/health")

    assert response.status_code == 405
    assert _assert_error_shape(response.json())["code"] == "MethodNotAllowed"


def test_validation_failure_returns_422_with_field_list(
    probe_app: FastAPI, client: TestClient
) -> None:
    response = client.get("/_probe/validate", params={"count": "not-a-number"})

    assert response.status_code == 422
    error = _assert_error_shape(response.json())
    assert error["code"] == "InvalidInput"
    assert error["details"]["fields"][0]["field"] == "count"
    assert error["details"]["fields"][0]["message"]


def test_app_error_keeps_its_status_code_and_details(
    probe_app: FastAPI, client: TestClient
) -> None:
    response = client.get("/_probe/app-error")

    assert response.status_code == 409
    error = _assert_error_shape(response.json())
    assert error == {
        "code": "HostedZoneNotEmpty",
        "message": "Zone is not empty.",
        "details": {"hosted_zone_id": "Z1"},
    }


def test_unhandled_exception_returns_generic_500_without_leaking_details(
    probe_app: FastAPI, client: TestClient
) -> None:
    response = client.get("/_probe/crash")

    assert response.status_code == 500
    error = _assert_error_shape(response.json())
    assert error["code"] == "InternalError"
    assert "secret internal detail" not in response.text
    assert "Traceback" not in response.text
