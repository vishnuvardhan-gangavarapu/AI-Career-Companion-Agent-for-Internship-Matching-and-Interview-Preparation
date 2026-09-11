from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.connection import Base


class Notification(Base):
    __tablename__ = "notifications"

    # =========================================================
    # PRIMARY KEY
    # =========================================================

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    # =========================================================
    # RECEIVER
    # =========================================================

    user_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    # =========================================================
    # NOTIFICATION CONTENT
    # =========================================================

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # =========================================================
    # NOTIFICATION TYPE
    #
    # Examples:
    #
    # new_user
    # new_application
    # application_approved
    # application_rejected
    # application_withdrawn
    # resume_uploaded
    # resume_analysis_completed
    # skill_gap_ready
    # profile_updated
    # password_changed
    # =========================================================

    notification_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    # =========================================================
    # READ STATUS
    # =========================================================

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    # =========================================================
    # RELATED ENTITY
    #
    # Example:
    #
    # related_entity_type = "application"
    # related_entity_id   = 25
    #
    # related_entity_type = "internship"
    # related_entity_id   = 10
    #
    # related_entity_type = "user"
    # related_entity_id   = 5
    # =========================================================

    related_entity_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    related_entity_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # =========================================================
    # CREATED TIME
    # =========================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ).replace(tzinfo=None),
        index=True,
    )

    # =========================================================
    # READ TIME
    #
    # NULL  → notification has never been read
    # VALUE → notification was read at this time
    # =========================================================

    read_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )