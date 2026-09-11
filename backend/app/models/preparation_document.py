from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class PreparationDocument(Base):
    __tablename__ = "preparation_documents"

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

    file_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    mime_type: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    file_size: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    storage_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    file_hash: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )

    extracted_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    page_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    character_count: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    analysis_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="processing",
    )

    analysis_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    analyzed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    conversation = relationship(
        "PreparationConversation",
        back_populates="documents",
    )

    message_links = relationship(
        "PreparationMessageDocument",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    sections = relationship(
        "PreparationDocumentSection",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PreparationDocumentSection.section_index",
    )

    chunks = relationship(
        "PreparationDocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PreparationDocumentChunk.chunk_index",
    )