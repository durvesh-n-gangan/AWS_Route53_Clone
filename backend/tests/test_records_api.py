"""Record set API (docs/PLAN.md §5.5)."""

import pytest
from fastapi.testclient import TestClient

ZONES = "/api/v1/hostedzones"


@pytest.fixture
def zone(auth_client: TestClient) -> dict:
    response = auth_client.post(ZONES, json={"name": "example.com"})
    assert response.status_code == 201
    return response.json()


def _records_url(zone: dict) -> str:
    return f"{ZONES}/{zone['id']}/records"


def _create(client: TestClient, zone: dict, *records: dict):
    return client.post(_records_url(zone), json={"records": list(records)})


def _record(name: str = "www", record_type: str = "A", values=None, ttl: int = 300) -> dict:
    return {"name": name, "type": record_type, "ttl": ttl, "values": values or ["192.0.2.10"]}


def _list(client: TestClient, zone: dict, **params) -> dict:
    return client.get(_records_url(zone), params=params).json()


def _zone_record_count(client: TestClient, zone: dict) -> int:
    return client.get(f"{ZONES}/{zone['id']}").json()["record_count"]


# --- create -----------------------------------------------------------------------------

ALL_TYPES = [
    _record("www", "A", ["192.0.2.10", "192.0.2.11"]),
    _record("v6", "AAAA", ["2001:db8::10"]),
    _record("alias", "CNAME", ["www.example.com"]),
    _record("@", "TXT", ['"v=spf1 -all"']),
    _record("@", "MX", ["10 mail.example.com", "20 backup.example.com"]),
    _record("sub", "NS", ["ns1.example.net", "ns2.example.net"]),
    _record("10", "PTR", ["host.example.com"]),
    _record("_sip._tcp", "SRV", ["10 5 5060 sip.example.com"]),
    _record("@", "CAA", ['0 issue "ca.example.net"']),
]


def test_create_every_supported_type_in_one_batch(auth_client: TestClient, zone: dict) -> None:
    response = _create(auth_client, zone, *ALL_TYPES)

    assert response.status_code == 201, response.text
    items = response.json()["items"]
    assert [item["type"] for item in items] == [r["type"] for r in ALL_TYPES]
    first = items[0]
    assert first["name"] == "www.example.com."
    assert first["values"] == ["192.0.2.10", "192.0.2.11"]
    assert first["routing_policy"] == "simple"
    assert first["set_identifier"] is None
    assert first["alias_target"] is None
    assert first["is_default"] is False
    assert _zone_record_count(auth_client, zone) == 2 + len(ALL_TYPES)


def test_batch_with_one_invalid_row_writes_nothing(auth_client: TestClient, zone: dict) -> None:
    response = _create(
        auth_client,
        zone,
        _record("a"),
        _record("b", values=["999.1.1.1"]),
        _record("c"),
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "InvalidChangeBatch"
    errors = error["details"]["errors"]
    assert errors[0] is None and errors[2] is None
    assert "999.1.1.1" in errors[1]["values"]
    assert _zone_record_count(auth_client, zone) == 2


def test_schema_level_errors_point_at_the_row(auth_client: TestClient, zone: dict) -> None:
    response = _create(auth_client, zone, _record("a"), _record("b", ttl=-1))

    assert response.status_code == 422
    fields = response.json()["error"]["details"]["fields"]
    assert fields[0]["field"] == "records.1.ttl"


def test_duplicate_record_set_is_409(auth_client: TestClient, zone: dict) -> None:
    _create(auth_client, zone, _record("www"))

    response = _create(auth_client, zone, _record("WWW.example.com.", values=["192.0.2.99"]))

    assert response.status_code == 409
    assert response.json()["error"]["message"] == (
        "Tried to create resource record set [name='www.example.com.', type='A'] but it "
        "already exists"
    )


def test_duplicates_inside_one_batch_are_409(auth_client: TestClient, zone: dict) -> None:
    response = _create(auth_client, zone, _record("x"), _record("x", values=["192.0.2.2"]))

    assert response.status_code == 409
    assert response.json()["error"]["details"]["errors"][0] is None


def test_cname_conflicts_with_existing_records(auth_client: TestClient, zone: dict) -> None:
    _create(auth_client, zone, _record("www"))

    response = _create(auth_client, zone, _record("www", "CNAME", ["target.example.org"]))

    assert response.status_code == 409
    assert (
        "RRSet of type CNAME with DNS name www.example.com."
        in (response.json()["error"]["message"])
    )


def test_records_cannot_be_added_next_to_a_cname(auth_client: TestClient, zone: dict) -> None:
    _create(auth_client, zone, _record("www", "CNAME", ["target.example.org"]))

    response = _create(auth_client, zone, _record("www", "TXT", ['"x"']))

    assert response.status_code == 409
    assert "conflicting RRSet of type CNAME" in response.json()["error"]["message"]


def test_cname_at_apex_is_rejected(auth_client: TestClient, zone: dict) -> None:
    response = _create(auth_client, zone, _record("@", "CNAME", ["target.example.org"]))

    assert response.status_code == 422
    assert "apex" in response.json()["error"]["details"]["errors"][0]["type"]


def test_user_cannot_create_soa(auth_client: TestClient, zone: dict) -> None:
    soa = "ns-1.awsdns-01.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    response = _create(auth_client, zone, _record("x", "SOA", [soa]))
    assert response.status_code == 422


def test_record_outside_the_zone_is_rejected(auth_client: TestClient, zone: dict) -> None:
    response = _create(auth_client, zone, _record("www.other.com."))

    assert response.status_code == 422
    assert "must be in the zone" in response.json()["error"]["details"]["errors"][0]["name"]


def test_unknown_type_is_422(auth_client: TestClient, zone: dict) -> None:
    assert _create(auth_client, zone, _record("x", "HINFO")).status_code == 422


def test_records_in_unknown_zone_are_404(auth_client: TestClient) -> None:
    response = auth_client.post(f"{ZONES}/ZNOPE/records", json={"records": [_record()]})
    assert response.status_code == 404


# --- list -------------------------------------------------------------------------------


def test_list_puts_default_records_first(auth_client: TestClient, zone: dict) -> None:
    _create(auth_client, zone, _record("aaa"), _record("@", "TXT", ['"hello"']))

    body = _list(auth_client, zone)

    assert body["total"] == 4
    assert [(r["type"], r["is_default"]) for r in body["items"][:2]] == [
        ("NS", True),
        ("SOA", True),
    ]
    assert [r["name"] for r in body["items"][2:]] == ["aaa.example.com.", "example.com."]


def test_list_search_matches_names_and_values(auth_client: TestClient, zone: dict) -> None:
    _create(auth_client, zone, _record("www"), _record("mail", values=["198.51.100.25"]))

    assert [r["name"] for r in _list(auth_client, zone, search="WWW")["items"]] == [
        "www.example.com."
    ]
    assert [r["name"] for r in _list(auth_client, zone, search="198.51")["items"]] == [
        "mail.example.com."
    ]


def test_list_type_filter_and_pagination(auth_client: TestClient, zone: dict) -> None:
    _create(auth_client, zone, *[_record(f"host{i}") for i in range(5)])

    body = _list(auth_client, zone, type="A", page_size=2, page=3)

    assert body["total"] == 5
    assert [r["name"] for r in body["items"]] == ["host4.example.com."]
    assert _list(auth_client, zone, routing_policy="simple")["total"] == 7


# --- update -----------------------------------------------------------------------------


def _first(client: TestClient, zone: dict, record_type: str) -> dict:
    return next(r for r in _list(client, zone, page_size=100)["items"] if r["type"] == record_type)


def test_update_record_values_and_ttl(auth_client: TestClient, zone: dict) -> None:
    created = _create(auth_client, zone, _record("www")).json()["items"][0]

    response = auth_client.put(
        f"{_records_url(zone)}/{created['id']}",
        json=_record("www", values=["203.0.113.5"], ttl=60),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["values"] == ["203.0.113.5"]
    assert body["ttl"] == 60
    assert body["updated_at"] > created["updated_at"]


def test_update_can_rename_and_retype(auth_client: TestClient, zone: dict) -> None:
    created = _create(auth_client, zone, _record("www")).json()["items"][0]

    response = auth_client.put(
        f"{_records_url(zone)}/{created['id']}",
        json=_record("web", "CNAME", ["target.example.org"]),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "web.example.com."
    assert response.json()["type"] == "CNAME"


def test_update_to_invalid_value_is_422_and_changes_nothing(
    auth_client: TestClient, zone: dict
) -> None:
    created = _create(auth_client, zone, _record("www")).json()["items"][0]

    response = auth_client.put(
        f"{_records_url(zone)}/{created['id']}", json=_record("www", values=["nope"])
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"]["fields"][0]["field"] == "values"
    assert _first(auth_client, zone, "A")["values"] == ["192.0.2.10"]


def test_update_into_an_existing_record_set_is_409(auth_client: TestClient, zone: dict) -> None:
    items = _create(auth_client, zone, _record("a"), _record("b")).json()["items"]

    response = auth_client.put(f"{_records_url(zone)}/{items[1]['id']}", json=_record("a"))

    assert response.status_code == 409


def test_default_ns_ttl_and_values_can_be_edited(auth_client: TestClient, zone: dict) -> None:
    ns = _first(auth_client, zone, "NS")

    response = auth_client.put(
        f"{_records_url(zone)}/{ns['id']}",
        json={"name": "@", "type": "NS", "ttl": 3600, "values": ns["values"]},
    )

    assert response.status_code == 200
    assert response.json()["ttl"] == 3600
    assert response.json()["is_default"] is True


def test_default_soa_values_can_be_edited(auth_client: TestClient, zone: dict) -> None:
    soa = _first(auth_client, zone, "SOA")
    new_value = soa["values"][0].replace(" 1 7200", " 2 7200")

    response = auth_client.put(
        f"{_records_url(zone)}/{soa['id']}",
        json={"name": "@", "type": "SOA", "ttl": 900, "values": [new_value]},
    )

    assert response.status_code == 200
    assert response.json()["values"] == [new_value]


def test_default_records_cannot_be_renamed(auth_client: TestClient, zone: dict) -> None:
    ns = _first(auth_client, zone, "NS")

    response = auth_client.put(
        f"{_records_url(zone)}/{ns['id']}",
        json={"name": "sub", "type": "NS", "ttl": 3600, "values": ns["values"]},
    )

    assert response.status_code == 409


def test_update_unknown_record_is_404(auth_client: TestClient, zone: dict) -> None:
    response = auth_client.put(f"{_records_url(zone)}/RNOPE", json=_record())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NoSuchResourceRecordSet"


# --- delete -----------------------------------------------------------------------------


def test_delete_record_updates_the_zone_count(auth_client: TestClient, zone: dict) -> None:
    created = _create(auth_client, zone, _record("www")).json()["items"][0]
    assert _zone_record_count(auth_client, zone) == 3

    response = auth_client.delete(f"{_records_url(zone)}/{created['id']}")

    assert response.status_code == 204
    assert _zone_record_count(auth_client, zone) == 2


@pytest.mark.parametrize(
    ("record_type", "message"),
    [
        ("SOA", "A HostedZone must contain exactly one SOA record."),
        ("NS", "A HostedZone must contain at least one NS record for the zone itself."),
    ],
)
def test_default_records_cannot_be_deleted(
    auth_client: TestClient, zone: dict, record_type: str, message: str
) -> None:
    record = _first(auth_client, zone, record_type)

    response = auth_client.delete(f"{_records_url(zone)}/{record['id']}")

    assert response.status_code == 409
    assert response.json()["error"]["message"] == message


def test_zone_can_be_deleted_after_its_records_are_removed(
    auth_client: TestClient, zone: dict
) -> None:
    created = _create(auth_client, zone, _record("www")).json()["items"][0]
    assert auth_client.delete(f"{ZONES}/{zone['id']}").status_code == 409

    auth_client.delete(f"{_records_url(zone)}/{created['id']}")

    assert auth_client.delete(f"{ZONES}/{zone['id']}").status_code == 204
