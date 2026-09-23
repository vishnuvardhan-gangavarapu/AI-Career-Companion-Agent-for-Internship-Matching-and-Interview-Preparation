from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Resume, ResumeProfile, User
from app.services.skill_gap_service import analyze_skill_gap


router = APIRouter(
    prefix="/api/skill-gap",
    tags=["Skill Gap"],
)


@router.get("")
def get_skill_gap(
    resume_id: int | None = Query(default=None, ge=1),
    target_role: str | None = Query(
        default=None,
        min_length=2,
        max_length=150,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a Skill Gap analysis for the authenticated intern.

    Resume selection:
        - If resume_id is supplied, use that resume only when it belongs
          to the authenticated user.
        - Otherwise, automatically use the authenticated user's latest
          analyzed resume that has a ResumeProfile.

    Role selection:
        - If target_role is supplied and is one of the supported roles,
          it is treated as an explicit manual override.
        - Otherwise, the service detects the role from the resume text or
          infers it from the analyzed skills.
    """

    # ---------------------------------------------------------
    # 1. USER ACCESS CHECK
    # ---------------------------------------------------------
    if str(current_user.role).lower() != "intern":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can access skill gap analysis.",
        )

    # ---------------------------------------------------------
    # 2. FIND A RESUME OWNED BY THE CURRENT USER
    # ---------------------------------------------------------
    query = db.query(Resume).filter(
        Resume.user_id == current_user.id,
    )

    if resume_id is not None:
        query = query.filter(
            Resume.id == resume_id,
        )
    else:
        # A ResumeProfile is created by the successful analysis pipeline.
        # Using the profile here avoids relying on one exact status value.
        query = query.join(
            ResumeProfile,
            ResumeProfile.resume_id == Resume.id,
        ).filter(
            ResumeProfile.user_id == current_user.id,
        )

    resume = (
        query
        .order_by(
            Resume.analyzed_at.desc().nullslast(),
            Resume.uploaded_at.desc(),
        )
        .first()
    )

    if not resume:
        if resume_id is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found for the current user.",
            )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No analysed resume was found for your account. "
                "Please analyse a resume first."
            ),
        )

    # ---------------------------------------------------------
    # 3. FIND PROFILE FOR THE EXACT RESUME + USER
    # ---------------------------------------------------------
    profile = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.resume_id == resume.id,
            ResumeProfile.user_id == current_user.id,
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This resume has not been analysed yet, or its analysed "
                "profile is missing. Please analyse the resume again."
            ),
        )

    # ---------------------------------------------------------
    # 4. CALCULATE SKILL GAP + DETECT ROLE
    # ---------------------------------------------------------
    result = analyze_skill_gap(
        profile=profile,
        resume=resume,
        target_role=target_role,
    )

    # ---------------------------------------------------------
    # 5. RETURN RESULT
    # ---------------------------------------------------------
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "name": current_user.full_name,
            "email": current_user.email,
        },
        "resume": {
            "id": resume.id,
            "file_name": resume.file_name,
            "analysis_status": resume.analysis_status,
            "analyzed_at": resume.analyzed_at,
        },
        "skill_gap": result,
    }
