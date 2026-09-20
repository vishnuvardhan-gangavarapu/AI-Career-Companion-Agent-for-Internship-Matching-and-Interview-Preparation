from sqlalchemy import (
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
from sqlalchemy.orm import relationship

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

    # Relationship with saved internships
    saved_by_users = relationship(
        "SavedInternship",
        back_populates="internship",
        cascade="all, delete-orphan",
    )


class SavedInternship(Base):
    __tablename__ = "saved_internships"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "internship_id",
            name="uq_saved_internship_user_internship",
        ),
    )

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

    internship_id = Column(
        Integer,
        ForeignKey(
            "internships.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    saved_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    # Relationship with User
    user = relationship(
        "User",
        back_populates="saved_internships",
    )

    # Relationship with Internship
    internship = relationship(
        "Internship",
        back_populates="saved_by_users",
    )