from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class PreparationDocumentChunk(Base):
    __tablename__ = "preparation_document_chunks"

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

    section_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey(
            "preparation_document_sections.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    page_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    character_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    document = relationship(
        "PreparationDocument",
        back_populates="chunks",
    )

    section = relationship(
        "PreparationDocumentSection",
        back_populates="chunks",
    )