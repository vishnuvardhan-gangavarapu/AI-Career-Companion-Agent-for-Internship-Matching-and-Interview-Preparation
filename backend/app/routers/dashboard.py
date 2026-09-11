from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db

from app.models import (
    Application,
    Internship,
    Resume,
    ResumeProfile,
    User,
)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


@router.get("")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    # =========================================================
    # INTERN DASHBOARD
    #
    # The dashboard is available only to normal intern users.
    # =========================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can access the dashboard",
        )


    # =========================================================
    # CURRENT RESUME / DASHBOARD READINESS
    # =========================================================

    current_resume = (
        db.query(Resume)
        .filter(
            Resume.user_id
            == current_user.id
        )
        .order_by(
            Resume.uploaded_at.desc()
        )
        .first()
    )

    has_resume = (
        current_resume is not None
    )

    resume_analysis_status = None

    has_analyzed_resume = False

    current_resume_profile = None

    has_user_data = False

    if current_resume:

        resume_analysis_status = (
            str(
                current_resume.analysis_status
                or ""
            )
            .strip()
            .lower()
        )

        has_analyzed_resume = (
            resume_analysis_status
            in {
                "analyzed",
                "analysed",
                "completed",
                "complete",
                "success",
            }
        )

        if has_analyzed_resume:

            current_resume_profile = (
                db.query(ResumeProfile)
                .filter(
                    ResumeProfile.resume_id
                    == current_resume.id,

                    ResumeProfile.user_id
                    == current_user.id,
                )
                .first()
            )

            has_user_data = (
                current_resume_profile
                is not None
            )

    dashboard_type = (
        "user"
        if (
            has_resume
            and has_analyzed_resume
            and has_user_data
        )
        else "default"
    )

    # =========================================================
    # PROFILE
    # =========================================================

    profile = current_resume_profile

    profile_data = None

    if profile:

        profile_data = {
            "profile_id": profile.id,

            "full_name": (
                profile.full_name
            ),

            "email": (
                profile.email
            ),

            "phone": (
                profile.phone
            ),

            "professional_summary": (
                profile.professional_summary
            ),
        }

    # =========================================================
    # APPLICATIONS
    # =========================================================

    applications = (
        db.query(Application)
        .filter(
            Application.user_id
            == current_user.id
        )
        .all()
    )

    total_applications = len(
        applications
    )

    pending_applications = sum(
        1
        for application in applications
        if application.status == "pending"
    )

    approved_applications = sum(
        1
        for application in applications
        if application.status == "approved"
    )

    rejected_applications = sum(
        1
        for application in applications
        if application.status == "rejected"
    )

    withdrawn_applications = sum(
        1
        for application in applications
        if application.status == "withdrawn"
    )

    # =========================================================
    # USER SKILLS
    # =========================================================

    user_skills = set()

    if profile:

        # Technical skills
        if profile.technical_skills:

            for skill in profile.technical_skills:

                if isinstance(skill, str):

                    user_skills.add(
                        skill.strip().lower()
                    )

        # General skills
        if profile.skills:

            for skill in profile.skills:

                if isinstance(skill, str):

                    user_skills.add(
                        skill.strip().lower()
                    )

    # =========================================================
    # INTERNSHIP MATCHING
    # =========================================================

    internships = (
        db.query(Internship)
        .all()
    )

    matched_internships = 0

    for internship in internships:

        required_skills = (
            internship.required_skills
        )

        if not required_skills:
            continue

        internship_skills = set()

        if isinstance(
            required_skills,
            list
        ):

            for skill in required_skills:

                if isinstance(
                    skill,
                    str
                ):

                    internship_skills.add(
                        skill.strip().lower()
                    )

        elif isinstance(
            required_skills,
            dict
        ):

            for value in required_skills.values():

                if isinstance(
                    value,
                    list
                ):

                    for skill in value:

                        if isinstance(
                            skill,
                            str
                        ):

                            internship_skills.add(
                                skill.strip().lower()
                            )

        if (
            user_skills
            and internship_skills
            and user_skills.intersection(
                internship_skills
            )
        ):

            matched_internships += 1

    # =========================================================
    # INTERN RESPONSE
    # =========================================================

    return {
        "message": (
            "Dashboard data retrieved successfully"
        ),

        # =====================================================
        # DASHBOARD STATE
        # =====================================================

        "dashboard_type": dashboard_type,

        "has_resume": has_resume,

        "resume_analysis_status": (
            resume_analysis_status
        ),

        "has_analyzed_resume": (
            has_analyzed_resume
        ),

        "has_user_data": has_user_data,

        "resume_id": (
            current_resume.id
            if current_resume
            else None
        ),

        # =====================================================
        # USER
        # =====================================================

        "user": {
            "id": current_user.id,

            "full_name": (
                current_user.full_name
            ),

            "email": (
                current_user.email
            ),

            "phone": (
                current_user.phone
            ),

            "role": (
                current_user.role
            ),
        },

        # =====================================================
        # PROFILE
        # =====================================================

        "profile": profile_data,

        # =====================================================
        # STATISTICS
        # =====================================================

        "statistics": {
            "matched_internships": (
                matched_internships
            ),

            "total_applications": (
                total_applications
            ),

            "pending_applications": (
                pending_applications
            ),

            "approved_applications": (
                approved_applications
            ),

            "rejected_applications": (
                rejected_applications
            ),

            "withdrawn_applications": (
                withdrawn_applications
            ),
        },
    }