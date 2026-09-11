from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class PreparationMessageDocument(Base):
    __tablename__ = "preparation_message_documents"

    message_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "preparation_messages.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    document_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "preparation_documents.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    message = relationship(
        "PreparationMessage",
        back_populates="document_links",
    )

    document = relationship(
        "PreparationDocument",
        back_populates="message_links",
    )