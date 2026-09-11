from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database.connection import Base

class ResumeProfile(Base):
    __tablename__ = "resume_profiles"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    resume_id = Column(
        Integer,
        ForeignKey(
            "resumes.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    full_name = Column(
        String(150),
        nullable=True,
    )

    email = Column(
        String(255),
        nullable=True,
    )

    phone = Column(
        String(30),
        nullable=True,
    )

    address = Column(
        Text,
        nullable=True,
    )

    linkedin_url = Column(
        String(500),
        nullable=True,
    )

    github_url = Column(
        String(500),
        nullable=True,
    )

    professional_summary = Column(
        Text,
        nullable=True,
    )

    skills = Column(
        JSONB,
        nullable=True,
    )

    technical_skills = Column(
        JSONB,
        nullable=True,
    )

    soft_skills = Column(
        JSONB,
        nullable=True,
    )

    education = Column(
        JSONB,
        nullable=True,
    )

    work_experience = Column(
        JSONB,
        nullable=True,
    )

    projects = Column(
        JSONB,
        nullable=True,
    )

    certifications = Column(
        JSONB,
        nullable=True,
    )

    internships = Column(
        JSONB,
        nullable=True,
    )

    languages = Column(
        JSONB,
        nullable=True,
    )

    achievements = Column(
        JSONB,
        nullable=True,
    )

    publications = Column(
        JSONB,
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

    resume = relationship(
        "Resume",
        back_populates="resume_profile",
    )
