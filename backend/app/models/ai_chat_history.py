from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from app.database.connection import Base


class AIChatHistory(Base):
    __tablename__ = "ai_chat_history"

    # =========================================================
    # PRIMARY KEY
    # =========================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # =========================================================
    # USER
    # =========================================================

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # =========================================================
    # CHAT SESSION
    # =========================================================

    session_id = Column(
        String(255),
        nullable=False,
        index=True,
    )

    # =========================================================
    # USER MESSAGE
    # =========================================================

    user_message = Column(
        Text,
        nullable=False,
    )

    # =========================================================
    # AI RESPONSE
    # =========================================================

    ai_response = Column(
        Text,
        nullable=False,
    )

    # =========================================================
    # CREATED TIME
    # =========================================================

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text(
            "CURRENT_TIMESTAMP"
        ),
        index=True,
    )

    # =========================================================
    # USER RELATIONSHIP
    # =========================================================

    user = relationship(
        "User",
    )
