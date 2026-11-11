from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.record import Record
    from app.models.user import User

ZONE_TYPES = ("public", "private")


class HostedZone(TimestampMixin, Base):
    """A hosted zone. `name` is always a lowercase FQDN with a trailing dot."""

    __tablename__ = "hosted_zones"
    __table_args__ = (
        UniqueConstraint("owner_id", "name", "type"),
        CheckConstraint("type IN ('public', 'private')", name="zone_type"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="public")
    comment: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    caller_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="hosted_zones")
    records: Mapped[list[Record]] = relationship(
        back_populates="hosted_zone", cascade="all, delete-orphan", passive_deletes=True
    )
    vpc_associations: Mapped[list[VpcAssociation]] = relationship(
        back_populates="hosted_zone", cascade="all, delete-orphan", passive_deletes=True
    )
    tags: Mapped[list[ZoneTag]] = relationship(
        back_populates="hosted_zone",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ZoneTag.key",
    )


class VpcAssociation(Base):
    """A VPC that can resolve a private hosted zone (mocked, no real VPC lookup)."""

    __tablename__ = "vpc_associations"
    __table_args__ = (UniqueConstraint("hosted_zone_id", "vpc_id", "region"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    hosted_zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True, nullable=False
    )
    vpc_id: Mapped[str] = mapped_column(String(32), nullable=False)
    region: Mapped[str] = mapped_column(String(32), nullable=False)

    hosted_zone: Mapped[HostedZone] = relationship(back_populates="vpc_associations")


class ZoneTag(Base):
    __tablename__ = "zone_tags"
    __table_args__ = (UniqueConstraint("hosted_zone_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    hosted_zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True, nullable=False
    )
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    value: Mapped[str] = mapped_column(String(256), nullable=False, default="")

    hosted_zone: Mapped[HostedZone] = relationship(back_populates="tags")
