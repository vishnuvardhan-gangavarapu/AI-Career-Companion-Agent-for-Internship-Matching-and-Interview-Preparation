from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db

from app.models import (
    Internship,
    SavedInternship,
    Resume,
    ResumeProfile,
    User,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/internships",
    tags=["Internships"],
)


# =========================================================
# NORMALIZE SKILL
# =========================================================

def normalize_skill(skill):
    """
    Convert skills into a comparable format.

    Example:

    React.js
    react js
    React JS

    will be normalized for easier comparison.
    """

    if not isinstance(skill, str):
        return ""

    skill = skill.strip().lower()

    replacements = {
        ".": "",
        "-": "",
        "_": "",
        " ": "",
        "/": "",
        "(": "",
        ")": "",
        "+": "plus",
    }

    for old, new in replacements.items():
        skill = skill.replace(old, new)

    return skill


# =========================================================
# CALCULATE MATCH
# =========================================================

def calculate_match(
    user_skills,
    required_skills,
):
    """
    Compare intern skills with internship skills.

    Returns:
        match_percentage
        matched_skills
        missing_skills
    """

    user_skill_map = {}

    for skill in user_skills:

        normalized = normalize_skill(
            skill
        )

        if normalized:
            user_skill_map[
                normalized
            ] = skill

    matched_skills = []

    missing_skills = []

    for required_skill in required_skills:

        normalized_required = normalize_skill(
            required_skill
        )

        if not normalized_required:
            continue

        if normalized_required in user_skill_map:

            matched_skills.append(
                required_skill
            )

        else:

            missing_skills.append(
                required_skill
            )

    total_required = len(
        required_skills
    )

    if total_required == 0:

        match_percentage = 0

    else:

        match_percentage = round(
            (
                len(matched_skills)
                / total_required
            )
            * 100
        )

    return (
        match_percentage,
        matched_skills,
        missing_skills,
    )


# =========================================================
# GET ALL INTERNSHIPS
# =========================================================
#
# PURPOSE:
#
# Default users can access internships
# without uploading or analyzing a resume.
#
# URL:
#
# GET /api/internships/all
#
# =========================================================

@router.get("/all")
def get_all_internships(
    location: str | None = Query(
        default=None,
        description="Filter by location",
    ),

    duration: str | None = Query(
        default=None,
        description="Filter by duration",
    ),

    search: str | None = Query(
        default=None,
        description="Search company or internship title",
    ),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    # =====================================================
    # USER ROLE CHECK
    # =====================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only interns can view internships"
            ),
        )

    # =====================================================
    # BASE QUERY
    # =====================================================

    query = db.query(
        Internship
    )

    # =====================================================
    # LOCATION FILTER
    # =====================================================

    if location:

        query = query.filter(
            Internship.location.ilike(
                f"%{location}%"
            )
        )

    # =====================================================
    # DURATION FILTER
    # =====================================================

    if duration:

        query = query.filter(
            Internship.duration.ilike(
                f"%{duration}%"
            )
        )

    # =====================================================
    # SEARCH FILTER
    # =====================================================

    if search:

        search_pattern = (
            f"%{search}%"
        )

        query = query.filter(
            (
                Internship.company_name.ilike(
                    search_pattern
                )
            )
            |
            (
                Internship.title.ilike(
                    search_pattern
                )
            )
        )

    # =====================================================
    # GET ALL INTERNSHIPS
    # =====================================================

    internships = (
        query
        .order_by(
            Internship.created_at.desc()
        )
        .all()
    )

    # =====================================================
    # RESPONSE LIST
    # =====================================================

    internship_list = []

    for internship in internships:

        required_skills = (
            internship.required_skills
        )

        # -------------------------------------------------
        # Make sure required_skills is a list
        # -------------------------------------------------

        if not isinstance(
            required_skills,
            list,
        ):

            required_skills = []

        internship_list.append(
            {
                "id": internship.id,

                "company_name": (
                    internship.company_name
                ),

                "title": (
                    internship.title
                ),

                "description": (
                    internship.description
                ),

                "location": (
                    internship.location
                ),

                "duration": (
                    internship.duration
                ),

                "work_mode": (
                    internship.work_mode
                ),

                "stipend": (
                    internship.stipend
                ),

                "start_date": (
                    internship.start_date
                ),

                "required_skills": (
                    required_skills
                ),

                "eligibility": (
                    internship.eligibility
                ),

                "responsibilities": (
                    internship.responsibilities
                ),

                "benefits": (
                    internship.benefits
                ),

                "application_url": (
                    internship.application_url
                ),

                "created_at": (
                    internship.created_at
                ),

                "updated_at": (
                    internship.updated_at
                ),
            }
        )

    # =====================================================
    # RETURN RESPONSE
    # =====================================================

    return {
        "message": (
            "All internships retrieved successfully"
        ),

        "total_internships": (
            len(internship_list)
        ),

        "internships": (
            internship_list
        ),
    }


# =========================================================
# GET MATCHED INTERNSHIPS
# =========================================================
#
# EXISTING RESUME-BASED API
#
# This API remains resume dependent.
#
# URL:
#
# GET /api/internships/matched
#
# =========================================================

@router.get("/matched")
def get_matched_internships(
    location: str | None = Query(
        default=None,
        description="Filter by location",
    ),

    duration: str | None = Query(
        default=None,
        description="Filter by duration",
    ),

    search: str | None = Query(
        default=None,
        description="Search company or internship title",
    ),

    min_match: int = Query(
        default=30,
        ge=0,
        le=100,
        description="Minimum skill match percentage",
    ),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    # =====================================================
    # USER ROLE CHECK
    # =====================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=403,
            detail=(
                "Only interns can view "
                "matched internships"
            ),
        )

    # =====================================================
    # GET LATEST ANALYZED RESUME PROFILE
    # =====================================================

    profile = (
        db.query(ResumeProfile)
        .join(
            Resume,
            Resume.id
            == ResumeProfile.resume_id,
        )
        .filter(
            ResumeProfile.user_id
            == current_user.id,

            Resume.analysis_status
            == "completed",
        )
        .order_by(
            Resume.analyzed_at.desc()
        )
        .first()
    )

    # =====================================================
    # PROFILE REQUIRED
    # =====================================================

    if not profile:

        raise HTTPException(
            status_code=404,
            detail=(
                "No analyzed resume profile found. "
                "Please upload and analyze your resume first."
            ),
        )

    # =====================================================
    # USER SKILLS
    # =====================================================

    user_skills = []

    # -----------------------------------------------------
    # Resume profile skills
    # -----------------------------------------------------

    if isinstance(
        profile.skills,
        list,
    ):

        user_skills.extend(
            profile.skills
        )

    # -----------------------------------------------------
    # Technical skills
    # -----------------------------------------------------

    if isinstance(
        profile.technical_skills,
        list,
    ):

        user_skills.extend(
            profile.technical_skills
        )

    # =====================================================
    # REMOVE DUPLICATE SKILLS
    # =====================================================

    unique_user_skills = []

    seen_skills = set()

    for skill in user_skills:

        normalized = normalize_skill(
            skill
        )

        if (
            normalized
            and normalized
            not in seen_skills
        ):

            seen_skills.add(
                normalized
            )

            unique_user_skills.append(
                skill
            )

    # =====================================================
    # INTERNSHIP QUERY
    # =====================================================

    query = db.query(
        Internship
    )

    # =====================================================
    # LOCATION
    # =====================================================

    if location:

        query = query.filter(
            Internship.location.ilike(
                f"%{location}%"
            )
        )

    # =====================================================
    # DURATION
    # =====================================================

    if duration:

        query = query.filter(
            Internship.duration.ilike(
                f"%{duration}%"
            )
        )

    # =====================================================
    # SEARCH
    # =====================================================

    if search:

        search_pattern = (
            f"%{search}%"
        )

        query = query.filter(
            (
                Internship.company_name.ilike(
                    search_pattern
                )
            )
            |
            (
                Internship.title.ilike(
                    search_pattern
                )
            )
        )

    # =====================================================
    # GET INTERNSHIPS
    # =====================================================

    internships = query.all()

    matched_internships = []

    # =====================================================
    # CALCULATE MATCH
    # =====================================================

    for internship in internships:

        required_skills = (
            internship.required_skills
        )

        if not isinstance(
            required_skills,
            list,
        ):

            required_skills = []

        (
            match_percentage,
            matched_skills,
            missing_skills,
        ) = calculate_match(
            unique_user_skills,
            required_skills,
        )

        # -------------------------------------------------
        # Minimum match filter
        # -------------------------------------------------

        if (
            match_percentage
            < min_match
        ):

            continue

        matched_internships.append(
            {
                "id": internship.id,

                "company_name": (
                    internship.company_name
                ),

                "title": (
                    internship.title
                ),

                "location": (
                    internship.location
                ),

                "duration": (
                    internship.duration
                ),

                "work_mode": (
                    internship.work_mode
                ),

                "stipend": (
                    internship.stipend
                ),

                "start_date": (
                    internship.start_date
                ),

                "match_percentage": (
                    match_percentage
                ),
            }
        )

    # =====================================================
    # SORT BY MATCH
    # =====================================================

    matched_internships.sort(
        key=lambda internship: (
            internship[
                "match_percentage"
            ]
        ),
        reverse=True,
    )

    # =====================================================
    # RETURN
    # =====================================================

    return {
        "message": (
            "Matched internships retrieved successfully"
        ),

        "profile_id": profile.id,

        "total_user_skills": len(
            unique_user_skills
        ),

        "total_internships": len(
            matched_internships
        ),

        "internships": (
            matched_internships
        ),
    }


# =========================================================
# GET INTERNSHIP DETAILS
# =========================================================
#
# IMPORTANT:
#
# Default users can now view details.
#
# Resume-analyzed users will also receive:
#
# - matched_skills
# - missing_skills
# - match_percentage
#
# Default users receive:
#
# - matched_skills = []
# - missing_skills = []
# - match_percentage = 0
#
# =========================================================


# =========================================================
# SAVED INTERNSHIPS
# =========================================================
# IMPORTANT:
#
# These static /saved routes MUST be registered before the
# dynamic /{internship_id} route below.
# Otherwise FastAPI can match "saved" against internship_id:int
# and return HTTP 422: Input should be a valid integer.
# =========================================================

@router.get("/saved")
def get_saved_internships(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can view saved internships",
        )

    rows = (
        db.query(
            SavedInternship,
            Internship,
        )
        .join(
            Internship,
            SavedInternship.internship_id
            == Internship.id,
        )
        .filter(
            SavedInternship.user_id
            == current_user.id
        )
        .order_by(
            SavedInternship.saved_at.desc()
        )
        .all()
    )

    internships = []

    for saved, internship in rows:

        internships.append(
            {
                "saved_id": saved.id,
                "saved_internship_id": saved.id,
                "saved_at": (
                    saved.saved_at.isoformat()
                    if saved.saved_at
                    else None
                ),
                "id": internship.id,
                "internship_id": internship.id,
                "title": internship.title,
                "company_name": internship.company_name,
                "location": internship.location,
                "duration": internship.duration,
                "work_mode": internship.work_mode,
                "stipend": internship.stipend,
                "start_date": (
                    internship.start_date.isoformat()
                    if internship.start_date
                    else None
                ),
                "required_skills": internship.required_skills or [],
                "description": internship.description,
                "eligibility": internship.eligibility,
                "responsibilities": internship.responsibilities,
                "benefits": internship.benefits,
                "application_url": internship.application_url,
            }
        )

    return {
        "total_saved": len(internships),
        "internships": internships,
    }


@router.post("/{internship_id}/save")
def save_internship(
    internship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can save internships",
        )

    internship = (
        db.query(Internship)
        .filter(
            Internship.id == internship_id
        )
        .first()
    )

    if not internship:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship not found",
        )

    existing = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id
            == current_user.id,
            SavedInternship.internship_id
            == internship_id,
        )
        .first()
    )

    # Idempotent save: a second click does not create an error.
    if existing:

        return {
            "message": "Internship is already saved",
            "saved": True,
            "saved_id": existing.id,
            "internship_id": internship.id,
        }

    saved = SavedInternship(
        user_id=current_user.id,
        internship_id=internship.id,
    )

    db.add(saved)
    db.commit()
    db.refresh(saved)

    return {
        "message": "Internship saved successfully",
        "saved": True,
        "saved_id": saved.id,
        "internship_id": internship.id,
    }


@router.delete("/{internship_id}/save")
def remove_saved_internship(
    internship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can remove saved internships",
        )

    saved = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id
            == current_user.id,
            SavedInternship.internship_id
            == internship_id,
        )
        .first()
    )

    if not saved:

        return {
            "message": "Internship is not saved",
            "saved": False,
            "internship_id": internship_id,
        }

    db.delete(saved)
    db.commit()

    return {
        "message": "Internship removed from saved internships",
        "saved": False,
        "internship_id": internship_id,
    }


@router.get("/{internship_id}")
def get_internship_details(
    internship_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    # =====================================================
    # USER ROLE CHECK
    # =====================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only interns can view "
                "internship details"
            ),
        )

    # =====================================================
    # GET INTERNSHIP
    # =====================================================

    internship = (
        db.query(Internship)
        .filter(
            Internship.id
            == internship_id
        )
        .first()
    )

    # =====================================================
    # NOT FOUND
    # =====================================================

    if not internship:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship not found",
        )

    # =====================================================
    # DEFAULT MATCH VALUES
    # =====================================================

    user_skills = []

    matched_skills = []

    missing_skills = []

    match_percentage = 0

    # =====================================================
    # GET ANALYZED RESUME PROFILE
    # =====================================================

    profile = (
        db.query(ResumeProfile)
        .join(
            Resume,
            Resume.id
            == ResumeProfile.resume_id,
        )
        .filter(
            ResumeProfile.user_id
            == current_user.id,

            Resume.analysis_status
            == "completed",
        )
        .order_by(
            Resume.analyzed_at.desc()
        )
        .first()
    )

    # =====================================================
    # REQUIRED INTERNSHIP SKILLS
    # =====================================================

    required_skills = (
        internship.required_skills
    )

    if not isinstance(
        required_skills,
        list,
    ):

        required_skills = []

    # =====================================================
    # IF RESUME PROFILE EXISTS
    # =====================================================

    if profile:

        # -------------------------------------------------
        # Resume skills
        # -------------------------------------------------

        if isinstance(
            profile.skills,
            list,
        ):

            user_skills.extend(
                profile.skills
            )

        # -------------------------------------------------
        # Technical skills
        # -------------------------------------------------

        if isinstance(
            profile.technical_skills,
            list,
        ):

            user_skills.extend(
                profile.technical_skills
            )

        # =================================================
        # REMOVE DUPLICATES
        # =================================================

        unique_user_skills = []

        seen_skills = set()

        for skill in user_skills:

            normalized = normalize_skill(
                skill
            )

            if (
                normalized
                and normalized
                not in seen_skills
            ):

                seen_skills.add(
                    normalized
                )

                unique_user_skills.append(
                    skill
                )

        user_skills = (
            unique_user_skills
        )

        # =================================================
        # CALCULATE MATCH
        # =================================================

        (
            match_percentage,
            matched_skills,
            missing_skills,
        ) = calculate_match(
            user_skills,
            required_skills,
        )

    # =====================================================
    # DEFAULT USER
    # =====================================================
    #
    # If there is no profile:
    #
    # - Details are still available
    # - No matching is calculated
    #
    # =====================================================

    else:

        user_skills = []

        matched_skills = []

        missing_skills = []

        match_percentage = 0

    # =====================================================
    # RETURN DETAILS
    # =====================================================

    return {
        "message": (
            "Internship details retrieved successfully"
        ),

        "internship": {

            "id": internship.id,

            "company_name": (
                internship.company_name
            ),

            "title": (
                internship.title
            ),

            "description": (
                internship.description
            ),

            "location": (
                internship.location
            ),

            "duration": (
                internship.duration
            ),

            "work_mode": (
                internship.work_mode
            ),

            "stipend": (
                internship.stipend
            ),

            "start_date": (
                internship.start_date
            ),

            "required_skills": (
                required_skills
            ),

            "matched_skills": (
                matched_skills
            ),

            "missing_skills": (
                missing_skills
            ),

            "match_percentage": (
                match_percentage
            ),

            "eligibility": (
                internship.eligibility
            ),

            "responsibilities": (
                internship.responsibilities
            ),

            "benefits": (
                internship.benefits
            ),

            "application_url": (
                internship.application_url
            ),
        },
    }


# =========================================================
# GET INTERNSHIP MATCH DETAILS
# =========================================================
#
# This endpoint remains specifically for users who have
# a resume profile.
#
# =========================================================

@router.get("/{internship_id}/match-details")
def get_internship_match_details(
    internship_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    # =====================================================
    # USER ROLE CHECK
    # =====================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only interns can view "
                "internship match details"
            ),
        )

    # =====================================================
    # GET INTERNSHIP
    # =====================================================

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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship not found",
        )

    # =====================================================
    # GET RESUME PROFILE
    # =====================================================

    profile = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.user_id
            == current_user.id
        )
        .order_by(
            ResumeProfile.updated_at.desc()
        )
        .first()
    )

    # =====================================================
    # PROFILE REQUIRED
    # =====================================================

    if not profile:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Resume profile not found. "
                "Please analyze your resume first."
            ),
        )

    # =====================================================
    # USER SKILLS
    # =====================================================

    user_skills = set()

    if profile.skills:

        for skill in profile.skills:

            if isinstance(
                skill,
                str,
            ):

                user_skills.add(
                    skill.strip().lower()
                )

    if profile.technical_skills:

        for skill in profile.technical_skills:

            if isinstance(
                skill,
                str,
            ):

                user_skills.add(
                    skill.strip().lower()
                )

    # =====================================================
    # INTERNSHIP SKILLS
    # =====================================================

    required_skills = (
        internship.required_skills
        or []
    )

    internship_skills = []

    if isinstance(
        required_skills,
        list,
    ):

        for skill in required_skills:

            if isinstance(
                skill,
                str,
            ):

                internship_skills.append(
                    skill.strip()
                )

    elif isinstance(
        required_skills,
        dict,
    ):

        for value in required_skills.values():

            if isinstance(
                value,
                list,
            ):

                for skill in value:

                    if isinstance(
                        skill,
                        str,
                    ):

                        internship_skills.append(
                            skill.strip()
                        )

    # =====================================================
    # REMOVE DUPLICATES
    # =====================================================

    unique_internship_skills = []

    seen = set()

    for skill in internship_skills:

        normalized = skill.lower()

        if normalized not in seen:

            seen.add(
                normalized
            )

            unique_internship_skills.append(
                skill
            )

    internship_skills = (
        unique_internship_skills
    )

    # =====================================================
    # MATCHED / MISSING
    # =====================================================

    matched_skills = []

    missing_skills = []

    for required_skill in internship_skills:

        normalized_required = (
            required_skill.lower()
        )

        if normalized_required in user_skills:

            matched_skills.append(
                required_skill
            )

        else:

            missing_skills.append(
                required_skill
            )

    # =====================================================
    # MATCH PERCENTAGE
    # =====================================================

    total_required_skills = len(
        internship_skills
    )

    if total_required_skills == 0:

        match_percentage = 0

    else:

        match_percentage = round(
            (
                len(matched_skills)
                / total_required_skills
            )
            * 100
        )

    # =====================================================
    # RETURN
    # =====================================================

    return {
        "message": (
            "Internship match details "
            "retrieved successfully"
        ),

        "internship": {

            "id": internship.id,

            "company_name": (
                internship.company_name
            ),

            "title": (
                internship.title
            ),

            "description": (
                internship.description
            ),

            "location": (
                internship.location
            ),

            "duration": (
                internship.duration
            ),

            "work_mode": (
                internship.work_mode
            ),

            "stipend": (
                internship.stipend
            ),

            "start_date": (
                internship.start_date
            ),

            "required_skills": (
                internship_skills
            ),

            "eligibility": (
                internship.eligibility
            ),

            "responsibilities": (
                internship.responsibilities
            ),

            "benefits": (
                internship.benefits
            ),

            "application_url": (
                internship.application_url
            ),
        },

        "match": {

            "match_percentage": (
                match_percentage
            ),

            "matched_skills": (
                matched_skills
            ),

            "missing_skills": (
                missing_skills
            ),

            "total_required_skills": (
                total_required_skills
            ),

            "total_matched_skills": (
                len(matched_skills)
            ),

            "total_missing_skills": (
                len(missing_skills)
            ),
        },

        "user_skills": sorted(
            user_skills
        ),
    }