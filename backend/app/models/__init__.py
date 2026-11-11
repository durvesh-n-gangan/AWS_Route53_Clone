"""Import every model so `Base.metadata` knows all tables (Alembic and tests rely on it)."""

from app.models.hosted_zone import HostedZone, VpcAssociation, ZoneTag
from app.models.record import RECORD_TYPES, Record
from app.models.session import UserSession
from app.models.user import User

__all__ = [
    "RECORD_TYPES",
    "HostedZone",
    "Record",
    "User",
    "UserSession",
    "VpcAssociation",
    "ZoneTag",
]
