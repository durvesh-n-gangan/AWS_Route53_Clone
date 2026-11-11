"""Hosted zone business logic.

Phase 2 provides zone creation with Route53's automatic SOA and NS records so the seed
script can reuse it. Listing, updating and deleting arrive with the API in Phase 5.
"""

import logging
import secrets
from collections.abc import Iterable, Mapping

from sqlalchemy.orm import Session

from app.core.ids import new_caller_reference, new_record_id, new_zone_id
from app.models import HostedZone, Record, User, VpcAssociation, ZoneTag
from app.services.validation import normalize_fqdn

logger = logging.getLogger(__name__)

# Route53 spreads a zone's four name servers over four top-level domains.
NAME_SERVER_TLDS = ("com", "net", "org", "co.uk")
DEFAULT_NS_TTL = 172_800
DEFAULT_SOA_TTL = 900
SOA_HOSTMASTER = "awsdns-hostmaster.amazon.com."
# serial, refresh, retry, expire, negative-cache TTL — the values Route53 uses by default.
SOA_TIMERS = "1 7200 900 1209600 86400"


def generate_name_servers() -> list[str]:
    """Four mock delegation-set name servers, e.g. `ns-1234.awsdns-12.org.`."""
    return [
        f"ns-{secrets.randbelow(2048)}.awsdns-{secrets.randbelow(64):02d}.{tld}."
        for tld in NAME_SERVER_TLDS
    ]


def build_default_records(zone_name: str, name_servers: list[str]) -> list[Record]:
    soa_value = f"{name_servers[0]} {SOA_HOSTMASTER} {SOA_TIMERS}"
    return [
        Record(
            id=new_record_id(),
            name=zone_name,
            type="NS",
            ttl=DEFAULT_NS_TTL,
            values=list(name_servers),
            is_default=True,
        ),
        Record(
            id=new_record_id(),
            name=zone_name,
            type="SOA",
            ttl=DEFAULT_SOA_TTL,
            values=[soa_value],
            is_default=True,
        ),
    ]


def create_zone(
    db: Session,
    owner: User,
    *,
    name: str,
    zone_type: str = "public",
    comment: str = "",
    vpcs: Iterable[tuple[str, str]] = (),
    tags: Mapping[str, str] | None = None,
) -> HostedZone:
    """Create a zone plus its default NS and SOA records. The caller commits."""
    zone_name = normalize_fqdn(name)
    zone = HostedZone(
        id=new_zone_id(),
        name=zone_name,
        type=zone_type,
        comment=comment,
        caller_reference=new_caller_reference(),
        owner=owner,
    )
    zone.vpc_associations = [VpcAssociation(vpc_id=vpc, region=region) for vpc, region in vpcs]
    zone.tags = [ZoneTag(key=key, value=value) for key, value in (tags or {}).items()]
    zone.records = build_default_records(zone_name, generate_name_servers())
    db.add(zone)
    db.flush()
    logger.info("Created hosted zone %s (%s)", zone.id, zone.name)
    return zone
