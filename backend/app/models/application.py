from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.connection import Base

class Application(Base):
    __tablename__ = "applications"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    internship_id = Column(
        Integer,
        ForeignKey(
            "internships.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    cover_letter = Column(
        Text,
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
    )

    applied_at = Column(
        DateTime(timezone=False),
        default=lambda: datetime.now(
            timezone.utc
        ).replace(tzinfo=None),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=False),
        default=lambda: datetime.now(
            timezone.utc
        ).replace(tzinfo=None),
        onupdate=lambda: datetime.now(
            timezone.utc
        ).replace(tzinfo=None),
        nullable=False,
    )

    withdrawn_at = Column(
        DateTime(timezone=False),
        nullable=True,
    )

    user = relationship(
        "User",
    )

    internship = relationship(
        "Internship",
    )