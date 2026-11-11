"""Hosted zone CRUD API (docs/PLAN.md §5.4)."""

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.ids import new_record_id
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import make_engine, make_session_factory
from app.models import HostedZone, Record, User
from app.services import zones as zone_service
from app.services.zones import ZONE_NOT_EMPTY_MESSAGE

ZONES = "/api/v1/hostedzones"
NS_PATTERN = re.compile(r"^ns-\d{1,4}\.awsdns-\d{2}\.(com|net|org|co\.uk)\.$")
VPC = {"vpc_id": "vpc-0a1b2c3d4e5f67890", "region": "us-east-1"}


def _create(client: TestClient, name: str = "example.com", **extra) -> dict:
    response = client.post(ZONES, json={"name": name, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def _add_record(db: Session, zone_id: str, name: str, record_type: str = "A") -> None:
    db.add(
        Record(
            id=new_record_id(),
            hosted_zone_id=zone_id,
            name=name,
            type=record_type,
            ttl=300,
            values=["192.0.2.1"],
        )
    )
    db.commit()


def _field_messages(response) -> list[str]:
    return [item["message"] for item in response.json()["error"]["details"]["fields"]]


# --- create -----------------------------------------------------------------------------


def test_create_public_zone_returns_route53_shaped_details(auth_client: TestClient) -> None:
    zone = _create(auth_client, "Example.COM", comment="Main site", tags=[{"key": "env"}])

    assert re.fullmatch(r"Z[0-9A-Z]{20}", zone["id"])
    assert zone["name"] == "example.com."
    assert zone["type"] == "public"
    assert zone["comment"] == "Main site"
    assert zone["record_count"] == 2
    assert zone["created_by"] == "Route 53"
    assert len(zone["name_servers"]) == 4
    assert all(NS_PATTERN.match(ns) for ns in zone["name_servers"])
    assert zone["tags"] == [{"key": "env", "value": ""}]
    assert zone["vpcs"] == []


def test_create_private_zone_requires_a_vpc(auth_client: TestClient) -> None:
    response = auth_client.post(ZONES, json={"name": "corp.example.org", "type": "private"})

    assert response.status_code == 422
    assert "at least one VPC" in _field_messages(response)[0]


def test_create_private_zone_with_vpc(auth_client: TestClient) -> None:
    zone = _create(auth_client, "corp.example.org", type="private", vpcs=[VPC])

    assert zone["type"] == "private"
    assert zone["vpcs"] == [VPC]


def test_public_zone_cannot_have_vpcs(auth_client: TestClient) -> None:
    response = auth_client.post(ZONES, json={"name": "example.com", "vpcs": [VPC]})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "vpc",
    [{"vpc_id": "vpc-xyz", "region": "us-east-1"}, {"vpc_id": VPC["vpc_id"], "region": "mars"}],
)
def test_invalid_vpc_values_are_rejected(auth_client: TestClient, vpc: dict) -> None:
    response = auth_client.post(
        ZONES, json={"name": "corp.example.org", "type": "private", "vpcs": [vpc]}
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "name",
    [
        "-bad-.com",
        "a..b.com",
        f"{'a' * 64}.com",
        ".".join(["abcdefghi"] * 26) + ".com",  # > 253 characters
        "localhost",
        "bad domain.com",
        "example.123",
        "",
    ],
)
def test_invalid_domain_names_are_rejected(auth_client: TestClient, name: str) -> None:
    response = auth_client.post(ZONES, json={"name": name})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "InvalidInput"


def test_validation_messages_have_no_pydantic_prefix(auth_client: TestClient) -> None:
    response = auth_client.post(ZONES, json={"name": "-bad-.com"})
    message = _field_messages(response)[0]

    assert not message.startswith("Value error")
    assert "-bad-" in message


def test_duplicate_zone_name_and_type_is_409(auth_client: TestClient) -> None:
    first = _create(auth_client, "example.com")

    response = auth_client.post(ZONES, json={"name": "EXAMPLE.com."})

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "HostedZoneAlreadyExists"
    assert first["id"] in error["message"]


def test_same_name_as_private_zone_is_allowed(auth_client: TestClient) -> None:
    _create(auth_client, "example.com")
    _create(auth_client, "example.com", type="private", vpcs=[VPC])


def test_duplicate_tag_keys_are_rejected(auth_client: TestClient) -> None:
    response = auth_client.post(
        ZONES, json={"name": "example.com", "tags": [{"key": "a"}, {"key": "a"}]}
    )
    assert response.status_code == 422


# --- list -------------------------------------------------------------------------------


@pytest.fixture
def three_zones(auth_client: TestClient, db: Session) -> dict[str, dict]:
    zones = {
        "alpha": _create(auth_client, "alpha.example.com", comment="Marketing site"),
        "beta": _create(auth_client, "beta.example.org", comment="API"),
        "gamma": _create(auth_client, "gamma.test", type="private", vpcs=[VPC], comment="Intranet"),
    }
    _add_record(db, zones["beta"]["id"], "www.beta.example.org.")
    _add_record(db, zones["beta"]["id"], "api.beta.example.org.")
    return zones


def _names(response) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


def test_list_returns_page_shape_with_record_counts(
    auth_client: TestClient, three_zones: dict
) -> None:
    body = auth_client.get(ZONES).json()

    assert set(body) == {"items", "total", "page", "page_size"}
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 10
    counts = {item["name"]: item["record_count"] for item in body["items"]}
    assert counts == {"alpha.example.com.": 2, "beta.example.org.": 4, "gamma.test.": 2}


@pytest.mark.parametrize(
    ("search", "expected"),
    [
        ("ALPHA", ["alpha.example.com."]),
        ("example", ["alpha.example.com.", "beta.example.org."]),
        ("intranet", ["gamma.test."]),
        ("%", []),
        ("_", []),
    ],
)
def test_search_is_case_insensitive_on_name_and_description(
    auth_client: TestClient, three_zones: dict, search: str, expected: list[str]
) -> None:
    assert _names(auth_client.get(ZONES, params={"search": search})) == expected


def test_search_matches_zone_id(auth_client: TestClient, three_zones: dict) -> None:
    zone_id = three_zones["beta"]["id"]
    assert _names(auth_client.get(ZONES, params={"search": zone_id.lower()})) == [
        "beta.example.org."
    ]


def test_type_filter(auth_client: TestClient, three_zones: dict) -> None:
    assert _names(auth_client.get(ZONES, params={"type": "private"})) == ["gamma.test."]
    assert len(_names(auth_client.get(ZONES, params={"type": "public"}))) == 2


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("name", ["alpha.example.com.", "beta.example.org.", "gamma.test."]),
        ("-name", ["gamma.test.", "beta.example.org.", "alpha.example.com."]),
        ("created_at", ["alpha.example.com.", "beta.example.org.", "gamma.test."]),
        ("-created_at", ["gamma.test.", "beta.example.org.", "alpha.example.com."]),
        ("-record_count", ["beta.example.org.", "alpha.example.com.", "gamma.test."]),
    ],
)
def test_sorting(auth_client: TestClient, three_zones: dict, sort: str, expected: list) -> None:
    names = _names(auth_client.get(ZONES, params={"sort": sort}))
    if sort == "-record_count":
        assert names[0] == expected[0]  # ties between the other two are broken by ID
    else:
        assert names == expected


def test_pagination(auth_client: TestClient, three_zones: dict) -> None:
    first = auth_client.get(ZONES, params={"page_size": 2}).json()
    second = auth_client.get(ZONES, params={"page_size": 2, "page": 2}).json()

    assert first["total"] == second["total"] == 3
    assert [i["name"] for i in first["items"]] == ["alpha.example.com.", "beta.example.org."]
    assert [i["name"] for i in second["items"]] == ["gamma.test."]
    assert second["page"] == 2


@pytest.mark.parametrize(
    "params", [{"page_size": 101}, {"page_size": 0}, {"page": 0}, {"sort": "bogus"}]
)
def test_invalid_list_parameters_are_422(auth_client: TestClient, params: dict) -> None:
    assert auth_client.get(ZONES, params=params).status_code == 422


def test_list_only_shows_the_callers_zones(
    auth_client: TestClient, three_zones: dict, db: Session
) -> None:
    other = User(username="other", password_hash=hash_password("pw"), account_id="999999999999")
    db.add(other)
    db.commit()
    zone_service.create_zone(db, other, name="secret.example.net")
    db.commit()

    assert "secret.example.net." not in _names(auth_client.get(ZONES))


# --- get / patch / delete ---------------------------------------------------------------


def test_get_zone_details(auth_client: TestClient) -> None:
    created = _create(auth_client)
    fetched = auth_client.get(f"{ZONES}/{created['id']}").json()

    assert fetched == created


def test_unknown_zone_is_404(auth_client: TestClient) -> None:
    response = auth_client.get(f"{ZONES}/ZDOESNOTEXIST")

    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "NoSuchHostedZone",
        "message": "No hosted zone found with ID: ZDOESNOTEXIST",
        "details": {},
    }


def test_another_users_zone_is_404(auth_client: TestClient, db: Session) -> None:
    other = User(username="other", password_hash=hash_password("pw"), account_id="999999999999")
    db.add(other)
    db.commit()
    foreign = zone_service.create_zone(db, other, name="secret.example.net")
    db.commit()

    for method in ("GET", "PATCH", "DELETE"):
        response = auth_client.request(method, f"{ZONES}/{foreign.id}", json={})
        assert response.status_code == 404, method


def test_patch_updates_comment_and_replaces_tags(auth_client: TestClient) -> None:
    created = _create(auth_client, tags=[{"key": "env", "value": "dev"}, {"key": "team"}])

    response = auth_client.patch(
        f"{ZONES}/{created['id']}",
        json={"comment": "Updated", "tags": [{"key": "env", "value": "prod"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["comment"] == "Updated"
    assert body["tags"] == [{"key": "env", "value": "prod"}]
    assert body["updated_at"] > created["updated_at"]
    assert body["name"] == created["name"]


def test_patch_with_only_a_comment_keeps_tags(auth_client: TestClient) -> None:
    created = _create(auth_client, tags=[{"key": "env", "value": "dev"}])

    body = auth_client.patch(f"{ZONES}/{created['id']}", json={"comment": "x"}).json()

    assert body["tags"] == [{"key": "env", "value": "dev"}]


def test_patch_rejects_long_comment(auth_client: TestClient) -> None:
    created = _create(auth_client)
    response = auth_client.patch(f"{ZONES}/{created['id']}", json={"comment": "x" * 257})
    assert response.status_code == 422


def test_delete_zone_with_only_default_records(auth_client: TestClient, db: Session) -> None:
    created = _create(auth_client)

    response = auth_client.delete(f"{ZONES}/{created['id']}")

    assert response.status_code == 204
    assert auth_client.get(f"{ZONES}/{created['id']}").status_code == 404
    assert db.scalars(select(Record)).all() == []


def test_delete_zone_with_user_records_is_409(auth_client: TestClient, db: Session) -> None:
    created = _create(auth_client)
    _add_record(db, created["id"], "www.example.com.")

    response = auth_client.delete(f"{ZONES}/{created['id']}")

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "HostedZoneNotEmpty"
    assert error["message"] == (
        "The specified hosted zone contains non-required resource record sets and so cannot "
        "be deleted."
    )
    assert error["message"] == ZONE_NOT_EMPTY_MESSAGE
    assert auth_client.get(f"{ZONES}/{created['id']}").status_code == 200


# --- persistence ------------------------------------------------------------------------


def test_zones_persist_in_the_sqlite_file_across_engines(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'persist.db'}"
    first_engine = make_engine(url)
    Base.metadata.create_all(first_engine)
    with make_session_factory(first_engine)() as db:
        owner = User(username="u", password_hash=hash_password("pw"), account_id="111111111111")
        db.add(owner)
        zone_service.create_zone(db, owner, name="persist.example.com")
        db.commit()
    first_engine.dispose()  # like stopping the server

    second_engine = make_engine(url)
    with make_session_factory(second_engine)() as db:
        zone = db.scalar(select(HostedZone))
        assert zone is not None
        assert zone.name == "persist.example.com."
        assert len(zone.records) == 2
    second_engine.dispose()
