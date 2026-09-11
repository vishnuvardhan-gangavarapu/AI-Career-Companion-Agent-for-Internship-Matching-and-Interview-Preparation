from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Notification, User


router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)


# =========================================================
# GET ALL NOTIFICATIONS
# =========================================================

@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return notifications belonging to the
    currently logged-in user.

    Newest notifications are returned first.
    """

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id
            == current_user.id
        )
        .order_by(
            Notification.created_at.desc()
        )
        .all()
    )

    unread_count = sum(
        1
        for notification in notifications
        if not notification.is_read
    )

    return {
        "message": (
            "Notifications retrieved successfully"
        ),

        "unread_count": unread_count,

        "total_count": len(
            notifications
        ),

        "notifications": [
            {
                "id": notification.id,

                "user_id": notification.user_id,

                "title": notification.title,

                "message": notification.message,

                "notification_type": (
                    notification.notification_type
                ),

                "is_read": notification.is_read,

                "related_entity_type": (
                    notification.related_entity_type
                ),

                "related_entity_id": (
                    notification.related_entity_id
                ),

                "created_at": (
                    notification.created_at
                ),

                "read_at": (
                    notification.read_at
                ),
            }
            for notification
            in notifications
        ],
    }


# =========================================================
# GET UNREAD COUNT
# =========================================================

@router.get("/unread-count")
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return only the unread notification count.

    This endpoint will later be useful for
    refreshing the bell badge without loading
    the complete notification list.
    """

    unread_count = (
        db.query(Notification)
        .filter(
            Notification.user_id
            == current_user.id,

            Notification.is_read
            == False,
        )
        .count()
    )

    return {
        "unread_count": unread_count,
    }


# =========================================================
# GET SINGLE NOTIFICATION
# =========================================================

@router.get("/{notification_id}")
def get_notification(
    notification_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return one notification belonging to
    the logged-in user.
    """

    notification = (
        db.query(Notification)
        .filter(
            Notification.id
            == notification_id,

            Notification.user_id
            == current_user.id,
        )
        .first()
    )

    if not notification:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail=(
                "Notification not found"
            ),
        )

    return {
        "id": notification.id,

        "user_id": notification.user_id,

        "title": notification.title,

        "message": notification.message,

        "notification_type": (
            notification.notification_type
        ),

        "is_read": notification.is_read,

        "related_entity_type": (
            notification.related_entity_type
        ),

        "related_entity_id": (
            notification.related_entity_id
        ),

        "created_at": (
            notification.created_at
        ),

        "read_at": (
            notification.read_at
        ),
    }


# =========================================================
# MARK ONE NOTIFICATION AS READ
# =========================================================

@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Mark one notification as read.
    """

    notification = (
        db.query(Notification)
        .filter(
            Notification.id
            == notification_id,

            Notification.user_id
            == current_user.id,
        )
        .first()
    )

    if not notification:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail=(
                "Notification not found"
            ),
        )

    notification.is_read = True

    notification.read_at = (
        datetime.utcnow()
    )

    db.commit()

    db.refresh(notification)

    return {
        "message": (
            "Notification marked as read"
        ),

        "notification": {
            "id": notification.id,

            "is_read": (
                notification.is_read
            ),

            "read_at": (
                notification.read_at
            ),
        },
    }


# =========================================================
# MARK ONE NOTIFICATION AS UNREAD
# =========================================================

@router.patch("/{notification_id}/unread")
def mark_notification_unread(
    notification_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Mark one notification as unread.
    """

    notification = (
        db.query(Notification)
        .filter(
            Notification.id
            == notification_id,

            Notification.user_id
            == current_user.id,
        )
        .first()
    )

    if not notification:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail=(
                "Notification not found"
            ),
        )

    notification.is_read = False

    notification.read_at = None

    db.commit()

    db.refresh(notification)

    return {
        "message": (
            "Notification marked as unread"
        ),

        "notification": {
            "id": notification.id,

            "is_read": (
                notification.is_read
            ),

            "read_at": (
                notification.read_at
            ),
        },
    }


# =========================================================
# MARK ALL NOTIFICATIONS AS READ
# =========================================================

@router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Mark every unread notification belonging
    to the logged-in user as read.
    """

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id
            == current_user.id,

            Notification.is_read
            == False,
        )
        .all()
    )

    read_time = datetime.utcnow()

    for notification in notifications:

        notification.is_read = True

        notification.read_at = (
            read_time
        )

    db.commit()

    return {
        "message": (
            "All notifications marked as read"
        ),

        "updated_count": len(
            notifications
        ),
    }


# =========================================================
# DELETE ONE NOTIFICATION
# =========================================================

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Delete one notification belonging to
    the logged-in user.
    """

    notification = (
        db.query(Notification)
        .filter(
            Notification.id
            == notification_id,

            Notification.user_id
            == current_user.id,
        )
        .first()
    )

    if not notification:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail=(
                "Notification not found"
            ),
        )

    db.delete(notification)

    db.commit()

    return {
        "message": (
            "Notification deleted successfully"
        )
    }


# =========================================================
# DELETE ALL NOTIFICATIONS
# =========================================================

@router.delete("")
def delete_all_notifications(
    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Delete all notifications belonging to
    the logged-in user.
    """

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id
            == current_user.id
        )
        .all()
    )

    count = len(notifications)

    for notification in notifications:

        db.delete(notification)

    db.commit()

    return {
        "message": (
            "All notifications deleted successfully"
        ),

        "deleted_count": count,
    }