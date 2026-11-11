"""Hosted zone business logic.

Creating a zone also creates Route 53's two required records (NS and SOA). Those defaults
never count as "content": a zone holding only them can be deleted.
"""

import logging
import secrets
from collections.abc import Iterable, Mapping

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.ids import new_caller_reference, new_record_id, new_zone_id
from app.db.base import utcnow
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


# --- Phase 5: hosted zone CRUD ------------------------------------------------------------

ZONE_NOT_EMPTY_MESSAGE = (
    "The specified hosted zone contains non-required resource record sets and so cannot be deleted."
)

_SORT_COLUMNS = {
    "name": HostedZone.name,
    "created_at": HostedZone.created_at,
}


def record_count_expression():
    """Correlated sub-select counting a zone's record sets (computed, never stored)."""
    return (
        select(func.count(Record.id))
        .where(Record.hosted_zone_id == HostedZone.id)
        .correlate(HostedZone)
        .scalar_subquery()
    )


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_zones(
    db: Session,
    owner: User,
    *,
    search: str | None = None,
    zone_type: str | None = None,
    sort: str = "name",
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[tuple[HostedZone, int]], int]:
    """One page of the owner's zones with their record counts, plus the total match count."""
    record_count = record_count_expression().label("record_count")
    query = select(HostedZone, record_count).where(HostedZone.owner_id == owner.id)

    if search and search.strip():
        pattern = f"%{_escape_like(search.strip().lower())}%"
        query = query.where(
            or_(
                func.lower(HostedZone.name).like(pattern, escape="\\"),
                func.lower(HostedZone.id).like(pattern, escape="\\"),
                func.lower(HostedZone.comment).like(pattern, escape="\\"),
            )
        )
    if zone_type:
        query = query.where(HostedZone.type == zone_type)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    descending = sort.startswith("-")
    key = sort.lstrip("-")
    column = record_count if key == "record_count" else _SORT_COLUMNS[key]
    ordering = column.desc() if descending else column.asc()
    rows = db.execute(
        query.order_by(ordering, HostedZone.id).limit(page_size).offset((page - 1) * page_size)
    ).all()
    return [(zone, count) for zone, count in rows], total


def get_zone(db: Session, owner: User, zone_id: str) -> HostedZone:
    zone = db.get(HostedZone, zone_id)
    # Another user's zone is reported exactly like a missing one.
    if zone is None or zone.owner_id != owner.id:
        raise AppError("NoSuchHostedZone", f"No hosted zone found with ID: {zone_id}", 404)
    return zone


def count_records(db: Session, zone: HostedZone, *, non_default_only: bool = False) -> int:
    query = select(func.count(Record.id)).where(Record.hosted_zone_id == zone.id)
    if non_default_only:
        query = query.where(Record.is_default.is_(False))
    return db.scalar(query) or 0


def name_servers(zone: HostedZone) -> list[str]:
    for record in zone.records:
        if record.is_default and record.type == "NS":
            return list(record.values)
    return []


def create_hosted_zone(
    db: Session,
    owner: User,
    *,
    name: str,
    zone_type: str,
    comment: str,
    vpcs: Iterable[tuple[str, str]],
    tags: Mapping[str, str],
) -> HostedZone:
    """API-level create: refuses duplicates with a Route 53 style error, then commits."""
    exists = db.scalar(
        select(HostedZone.id).where(
            HostedZone.owner_id == owner.id,
            HostedZone.name == name,
            HostedZone.type == zone_type,
        )
    )
    if exists:
        raise AppError(
            "HostedZoneAlreadyExists",
            f"A {zone_type} hosted zone named {name} already exists (ID: {exists}).",
            409,
        )
    try:
        zone = create_zone(
            db, owner, name=name, zone_type=zone_type, comment=comment, vpcs=vpcs, tags=tags
        )
        db.commit()
    except IntegrityError as exc:  # lost a race with an identical request
        db.rollback()
        raise AppError(
            "HostedZoneAlreadyExists",
            f"A {zone_type} hosted zone named {name} already exists.",
            409,
        ) from exc
    return zone


def update_zone(
    db: Session,
    zone: HostedZone,
    *,
    comment: str | None = None,
    tags: Mapping[str, str] | None = None,
) -> HostedZone:
    if comment is not None:
        zone.comment = comment
    if tags is not None:
        zone.tags.clear()
        db.flush()  # delete old tags first so re-used keys don't hit the unique constraint
        zone.tags.extend(ZoneTag(key=key, value=value) for key, value in tags.items())
    zone.updated_at = utcnow()
    db.commit()
    db.refresh(zone)
    logger.info("Updated hosted zone %s", zone.id)
    return zone


def delete_zone(db: Session, zone: HostedZone) -> None:
    if count_records(db, zone, non_default_only=True) > 0:
        raise AppError(
            "HostedZoneNotEmpty", ZONE_NOT_EMPTY_MESSAGE, 409, details={"hosted_zone_id": zone.id}
        )
    db.delete(zone)
    db.commit()
    logger.info("Deleted hosted zone %s", zone.id)
