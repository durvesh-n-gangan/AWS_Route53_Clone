import ipaddress
import re

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.db.seed import DEMO_PASSWORD, DEMO_USERNAME, seed
from app.models import HostedZone, Record, User
from app.services.validation import normalize_fqdn, qualify_record_name
from app.services.zones import generate_name_servers

DOC_NETWORKS = [
    ipaddress.ip_network(net)
    for net in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "2001:db8::/32")
]
NS_PATTERN = re.compile(r"^ns-\d{1,4}\.awsdns-\d{2}\.(com|net|org|co\.uk)\.$")


def test_seed_is_idempotent(db: Session) -> None:
    assert seed(db) is True
    assert seed(db) is False

    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert db.scalar(select(func.count()).select_from(HostedZone)) == 2


def test_seeded_user_can_authenticate_with_demo_password(db: Session) -> None:
    seed(db)
    user = db.scalar(select(User).where(User.username == DEMO_USERNAME))

    assert user is not None
    assert verify_password(DEMO_PASSWORD, user.password_hash)
    assert re.fullmatch(r"\d{12}", user.account_id)


def test_every_seeded_zone_has_exactly_one_default_soa_and_ns(db: Session) -> None:
    seed(db)

    for zone in db.scalars(select(HostedZone)):
        defaults = [r for r in zone.records if r.is_default]
        assert sorted(r.type for r in defaults) == ["NS", "SOA"]
        assert all(r.name == zone.name for r in defaults)


def test_default_ns_record_has_four_name_servers_on_four_tlds(db: Session) -> None:
    seed(db)
    ns = db.scalar(select(Record).where(Record.type == "NS", Record.is_default.is_(True)))

    assert ns is not None
    assert ns.ttl == 172_800
    assert len(ns.values) == 4
    assert all(NS_PATTERN.match(value) for value in ns.values)
    assert {value.rsplit("awsdns-", 1)[1][3:] for value in ns.values} == {
        "com.",
        "net.",
        "org.",
        "co.uk.",
    }


def test_default_soa_points_at_the_first_name_server(db: Session) -> None:
    seed(db)
    zone = db.scalar(select(HostedZone).where(HostedZone.name == "example.com."))
    assert zone is not None
    ns = next(r for r in zone.records if r.type == "NS")
    soa = next(r for r in zone.records if r.type == "SOA")

    assert soa.ttl == 900
    assert soa.values == [f"{ns.values[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"]


def test_seed_uses_only_reserved_domains_and_documentation_ips(db: Session) -> None:
    seed(db)

    for zone in db.scalars(select(HostedZone)):
        assert zone.name.endswith(("example.com.", "example.org.", ".test."))
    for record in db.scalars(select(Record).where(Record.type.in_(["A", "AAAA"]))):
        for value in record.values:
            address = ipaddress.ip_address(value)
            assert any(address in net for net in DOC_NETWORKS), value


def test_private_seed_zone_has_a_vpc_association(db: Session) -> None:
    seed(db)
    private = db.scalar(select(HostedZone).where(HostedZone.type == "private"))

    assert private is not None
    assert [(v.vpc_id, v.region) for v in private.vpc_associations] == [
        ("vpc-0a1b2c3d4e5f67890", "us-east-1")
    ]


def test_generated_name_servers_match_route53_shape() -> None:
    servers = generate_name_servers()
    assert len(servers) == 4
    assert all(NS_PATTERN.match(server) for server in servers)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("Example.COM", "example.com."), (" example.com. ", "example.com."), ("a.b..", "a.b.")],
)
def test_normalize_fqdn(raw: str, expected: str) -> None:
    assert normalize_fqdn(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", "example.com."),
        ("@", "example.com."),
        ("www", "www.example.com."),
        ("WWW", "www.example.com."),
        ("www.example.com", "www.example.com."),
        ("example.com", "example.com."),
        ("api.v2", "api.v2.example.com."),
        ("other.org.", "other.org."),
    ],
)
def test_qualify_record_name(raw: str, expected: str) -> None:
    assert qualify_record_name(raw, "example.com.") == expected
