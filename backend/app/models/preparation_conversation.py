from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class PreparationConversation(Base):
    __tablename__ = "preparation_conversations"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    messages = relationship(
        "PreparationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PreparationMessage.created_at",
    )

    documents = relationship(
        "PreparationDocument",
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PreparationDocument.created_at",
    )