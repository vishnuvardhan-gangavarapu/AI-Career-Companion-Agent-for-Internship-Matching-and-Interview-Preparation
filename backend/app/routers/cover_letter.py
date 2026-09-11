from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import (
    Internship,
    Resume,
    ResumeProfile,
    User,
)

from app.services.cover_letter_generator import (
    generate_cover_letter,
)

router = APIRouter(
    prefix="/api/cover-letters",
    tags=["Cover Letter"],
)

def get_latest_profile(
    db: Session,
    user_id: int,
):
    return (
        db.query(ResumeProfile)
        .join(
            Resume,
            Resume.id
            == ResumeProfile.resume_id,
        )
        .filter(
            ResumeProfile.user_id
            == user_id,

            Resume.analysis_status
            == "completed",
        )
        .order_by(
            Resume.analyzed_at.desc()
        )
        .first()
    )

@router.post(
    "/generate/{internship_id}"
)
def generate_cover_letter_api(
    internship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "intern":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only interns can generate "
                "cover letters"
            ),
        )

    internship = (
        db.query(Internship)
        .filter(
            Internship.id
            == internship_id
        )
        .first()
    )

    if not internship:
        raise HTTPException(
            status_code=404,
            detail="Internship not found",
        )

    profile = get_latest_profile(
        db,
        current_user.id,
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                "Please analyze your resume "
                "before generating a cover letter"
            ),
        )

    try:
        cover_letter = (
            generate_cover_letter(
                profile,
                internship,
            )
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Cover letter generation failed: {str(exc)}"
            ),
        )

    return {
        "message": (
            "Cover letter generated successfully"
        ),

        "internship_id": internship.id,

        "company_name": (
            internship.company_name
        ),

        "job_title": (
            internship.title
        ),

        "cover_letter": cover_letter,
    }

@router.post(
    "/regenerate/{internship_id}"
)
def regenerate_cover_letter_api(
    internship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "intern":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only interns can regenerate "
                "cover letters"
            ),
        )

    internship = (
        db.query(Internship)
        .filter(
            Internship.id
            == internship_id
        )
        .first()
    )

    if not internship:
        raise HTTPException(
            status_code=404,
            detail="Internship not found",
        )

    profile = get_latest_profile(
        db,
        current_user.id,
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                "Please analyze your resume "
                "before generating a cover letter"
            ),
        )

    variation_instruction = """
This is a REGENERATED cover letter.

Create a fresh version that is substantially
different in wording and sentence structure
from a typical previous version.

You may change:
- opening paragraph
- paragraph order
- wording
- transitions
- emphasis on relevant projects
- closing paragraph

However, keep all candidate facts accurate.

Do not add information that is not present
in the supplied candidate profile.

Do not mention that this is a regenerated
cover letter.
"""

    try:
        cover_letter = (
            generate_cover_letter(
                profile,
                internship,
                variation_instruction,
            )
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Cover letter regeneration failed: {str(exc)}"
            ),
        )

    return {
        "message": (
            "Cover letter regenerated successfully"
        ),

        "internship_id": (
            internship.id
        ),

        "company_name": (
            internship.company_name
        ),

        "job_title": (
            internship.title
        ),

        "cover_letter": (
            cover_letter
        ),
    }