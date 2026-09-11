from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class PreparationMessage(Base):
    __tablename__ = "preparation_messages"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    conversation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "preparation_conversations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    conversation = relationship(
        "PreparationConversation",
        back_populates="messages",
    )

    document_links = relationship(
        "PreparationMessageDocument",
        back_populates="message",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )