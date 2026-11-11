from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.hosted_zone import HostedZone

# SOA is only ever created automatically with the zone; users manage the other nine.
RECORD_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA")
MAX_TTL = 2_147_483_647

_TYPE_LIST_SQL = ", ".join(f"'{record_type}'" for record_type in RECORD_TYPES)


class Record(TimestampMixin, Base):
    """One Route53 record set: a (name, type) pair holding one or more values.

    `set_identifier` is an empty string for Simple routing rather than NULL, because
    SQLite treats NULLs as distinct and the unique constraint would stop working.
    """

    __tablename__ = "records"
    __table_args__ = (
        UniqueConstraint("hosted_zone_id", "name", "type", "set_identifier"),
        Index("ix_records_hosted_zone_id_type", "hosted_zone_id", "type"),
        CheckConstraint(f"type IN ({_TYPE_LIST_SQL})", name="record_type"),
        CheckConstraint(f"ttl >= 0 AND ttl <= {MAX_TTL}", name="ttl_range"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    hosted_zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    ttl: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    values: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    routing_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="simple")
    set_identifier: Mapped[str] = mapped_column(
        String(128), nullable=False, default="", server_default=""
    )
    alias_target: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )

    hosted_zone: Mapped[HostedZone] = relationship(back_populates="records")
