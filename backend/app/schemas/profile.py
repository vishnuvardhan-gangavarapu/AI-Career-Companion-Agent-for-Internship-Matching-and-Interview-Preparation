from typing import Any

from pydantic import BaseModel, Field

class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    address: str | None = None

    linkedin_url: str | None = Field(
        default=None,
        max_length=500,
    )

    github_url: str | None = Field(
        default=None,
        max_length=500,
    )

    professional_summary: str | None = None
    skills: list[Any] | None = None
    technical_skills: list[Any] | None = None
    soft_skills: list[Any] | None = None
    education: list[Any] | None = None
    work_experience: list[Any] | None = None
    projects: list[Any] | None = None
    certifications: list[Any] | None = None
    internships: list[Any] | None = None
    languages: list[Any] | None = None
    achievements: list[Any] | None = None
    publications: list[Any] | None = None