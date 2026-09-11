from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.database.connection import Base

class Internship(Base):
    __tablename__ = "internships"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    company_name = Column(
        String(255),
        nullable=False,
    )

    title = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    location = Column(
        String(150),
        nullable=False,
    )

    duration = Column(
        String(100),
        nullable=True,
    )

    work_mode = Column(
        String(50),
        nullable=True,
    )

    stipend = Column(
        String(100),
        nullable=True,
    )

    start_date = Column(
        Date,
        nullable=True,
    )

    required_skills = Column(
        JSONB,
        nullable=False,
    )

    eligibility = Column(
        Text,
        nullable=True,
    )

    responsibilities = Column(
        Text,
        nullable=True,
    )

    benefits = Column(
        Text,
        nullable=True,
    )

    application_url = Column(
        String(1000),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

class SavedInternship(Base):
    __tablename__ = "saved_internships"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    internship_id = Column(
        Integer,
        ForeignKey("internships.id"),
        nullable=False,
    )

    saved_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )