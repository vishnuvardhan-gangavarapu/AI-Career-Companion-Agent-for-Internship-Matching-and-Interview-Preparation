from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification


# =========================================================
# INTERNAL TIME HELPER
# =========================================================

def _utc_now() -> datetime:
    """
    Return current UTC time as a naive datetime.

    Your existing database models use naive UTC datetimes,
    so we keep the same convention here.
    """

    return datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )


# =========================================================
# CREATE NOTIFICATION
# =========================================================

def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
) -> Notification:
    """
    Create and save one notification.

    Parameters
    ----------
    db:
        SQLAlchemy database session.

    user_id:
        ID of the user who should receive the notification.

    title:
        Short notification title.

    message:
        Full notification message.

    notification_type:
        Notification category.

    related_entity_type:
        Optional related object type.

        Examples:
        - user
        - application
        - internship
        - resume

    related_entity_id:
        Optional ID of the related object.
    """

    notification = Notification(
        user_id=user_id,

        title=title,

        message=message,

        notification_type=notification_type,

        is_read=False,

        related_entity_type=(
            related_entity_type
        ),

        related_entity_id=(
            related_entity_id
        ),

        created_at=_utc_now(),

        read_at=None,
    )

    db.add(notification)

    db.commit()

    db.refresh(notification)

    return notification


# =========================================================
# CREATE USER NOTIFICATION
# =========================================================

def create_user_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
) -> Notification:
    """
    Create a notification for a specific user.

    This is mainly used for intern/user-side events.
    """

    return create_notification(
        db=db,

        user_id=user_id,

        title=title,

        message=message,

        notification_type=notification_type,

        related_entity_type=(
            related_entity_type
        ),

        related_entity_id=(
            related_entity_id
        ),
    )


# =========================================================
# MARK NOTIFICATION AS READ
# =========================================================

def mark_notification_as_read(
    db: Session,
    notification: Notification,
) -> Notification:
    """
    Mark one notification as read.
    """

    notification.is_read = True

    notification.read_at = _utc_now()

    db.commit()

    db.refresh(notification)

    return notification


# =========================================================
# MARK NOTIFICATION AS UNREAD
# =========================================================

def mark_notification_as_unread(
    db: Session,
    notification: Notification,
) -> Notification:
    """
    Mark one notification as unread again.
    """

    notification.is_read = False

    notification.read_at = None

    db.commit()

    db.refresh(notification)

    return notification


# =========================================================
# MARK ALL USER NOTIFICATIONS AS READ
# =========================================================

def mark_all_notifications_as_read(
    db: Session,
    user_id: int,
) -> int:
    """
    Mark all unread notifications belonging to
    one user as read.

    Returns:
        Number of notifications updated.
    """

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id
            == user_id,

            Notification.is_read
            == False,
        )
        .all()
    )

    current_time = _utc_now()

    for notification in notifications:

        notification.is_read = True

        notification.read_at = (
            current_time
        )

    db.commit()

    return len(notifications)


# =========================================================
# DELETE ONE NOTIFICATION
# =========================================================

def delete_notification(
    db: Session,
    notification: Notification,
) -> None:
    """
    Delete one notification.
    """

    db.delete(notification)

    db.commit()


# =========================================================
# DELETE ALL USER NOTIFICATIONS
# =========================================================

def delete_all_user_notifications(
    db: Session,
    user_id: int,
) -> int:
    """
    Delete all notifications belonging to
    one user.

    Returns:
        Number of notifications deleted.
    """

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id
            == user_id
        )
        .all()
    )

    count = len(notifications)

    for notification in notifications:

        db.delete(notification)

    db.commit()

    return count