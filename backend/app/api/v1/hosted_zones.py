"""Hosted zone endpoints: /api/v1/hostedzones."""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.models import HostedZone
from app.schemas.common import MAX_PAGE_SIZE, BulkDeleteRequest, BulkDeleteResult, BulkFailure, Page
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneSummary,
    HostedZoneUpdate,
    Tag,
    VpcOut,
    ZoneSort,
    ZoneType,
)
from app.services import zones as zone_service

router = APIRouter(prefix="/hostedzones", tags=["hosted zones"])


def _summary(zone: HostedZone, record_count: int) -> HostedZoneSummary:
    return HostedZoneSummary(
        id=zone.id,
        name=zone.name,
        type=zone.type,  # type: ignore[arg-type]
        comment=zone.comment,
        record_count=record_count,
        caller_reference=zone.caller_reference,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def _detail(db: DbSession, zone: HostedZone) -> HostedZoneDetail:
    summary = _summary(zone, zone_service.count_records(db, zone))
    return HostedZoneDetail(
        **summary.model_dump(),
        name_servers=zone_service.name_servers(zone),
        tags=[Tag.model_validate(tag) for tag in zone.tags],
        vpcs=[VpcOut.model_validate(vpc) for vpc in zone.vpc_associations],
    )


@router.get("", response_model=Page[HostedZoneSummary])
def list_hosted_zones(
    db: DbSession,
    user: CurrentUser,
    search: Annotated[str | None, Query(max_length=255)] = None,
    type: ZoneType | None = None,  # noqa: A002 - matches the public query parameter name
    sort: ZoneSort = "name",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 10,
):
    rows, total = zone_service.list_zones(
        db, user, search=search, zone_type=type, sort=sort, page=page, page_size=page_size
    )
    return Page[HostedZoneSummary](
        items=[_summary(zone, count) for zone, count in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=HostedZoneDetail, status_code=status.HTTP_201_CREATED)
def create_hosted_zone(body: HostedZoneCreate, db: DbSession, user: CurrentUser):
    zone = zone_service.create_hosted_zone(
        db,
        user,
        name=body.name,
        zone_type=body.type,
        comment=body.comment,
        vpcs=[(vpc.vpc_id, vpc.region) for vpc in body.vpcs],
        tags={tag.key: tag.value for tag in body.tags},
    )
    return _detail(db, zone)


@router.post("/bulk-delete", response_model=BulkDeleteResult)
def bulk_delete_hosted_zones(body: BulkDeleteRequest, db: DbSession, user: CurrentUser):
    """Delete several zones; non-empty or unknown zones are reported, not fatal."""
    result = BulkDeleteResult(deleted=[], failed=[])
    for zone_id in dict.fromkeys(body.ids):  # de-duplicate, keep order
        try:
            zone_service.delete_zone(db, zone_service.get_zone(db, user, zone_id))
            result.deleted.append(zone_id)
        except AppError as exc:
            db.rollback()
            result.failed.append(BulkFailure(id=zone_id, code=exc.code, message=exc.message))
    return result


@router.get("/{zone_id}", response_model=HostedZoneDetail)
def get_hosted_zone(zone_id: str, db: DbSession, user: CurrentUser):
    return _detail(db, zone_service.get_zone(db, user, zone_id))


@router.patch("/{zone_id}", response_model=HostedZoneDetail)
def update_hosted_zone(zone_id: str, body: HostedZoneUpdate, db: DbSession, user: CurrentUser):
    zone = zone_service.get_zone(db, user, zone_id)
    zone = zone_service.update_zone(
        db,
        zone,
        comment=body.comment,
        tags=None if body.tags is None else {tag.key: tag.value for tag in body.tags},
    )
    return _detail(db, zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hosted_zone(zone_id: str, db: DbSession, user: CurrentUser) -> Response:
    zone_service.delete_zone(db, zone_service.get_zone(db, user, zone_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
