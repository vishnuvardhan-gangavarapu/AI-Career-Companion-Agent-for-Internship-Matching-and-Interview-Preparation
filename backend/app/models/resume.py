from sqlalchemy import (
    BigInteger,
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

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    file_name = Column(
        String(255),
        nullable=False,
    )

    file_type = Column(
        String(20),
        nullable=False,
    )

    file_path = Column(
        String(500),
        nullable=False,
    )

    file_size = Column(
        BigInteger,
        nullable=True,
    )

    file_hash = Column(
        String(64),
        nullable=False,
    )

    extracted_text = Column(
        Text,
        nullable=True,
    )

    analysis_status = Column(
        String(30),
        nullable=False,
        server_default=text("'uploaded'"),
    )

    uploaded_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    analyzed_at = Column(
        DateTime,
        nullable=True,
    )

    user = relationship(
        "User",
        back_populates="resumes",
    )

    resume_profile = relationship(
        "ResumeProfile",
        back_populates="resume",
        uselist=False,
        cascade="all, delete-orphan",
    )