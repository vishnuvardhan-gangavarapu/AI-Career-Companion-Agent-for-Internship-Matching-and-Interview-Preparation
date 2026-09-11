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


class PreparationDocumentSection(Base):
    __tablename__ = "preparation_document_sections"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    document_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "preparation_documents.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    section_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    title: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    page_start: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    page_end: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    section_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    document = relationship(
        "PreparationDocument",
        back_populates="sections",
    )

    chunks = relationship(
        "PreparationDocumentChunk",
        back_populates="section",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PreparationDocumentChunk.chunk_index",
    )