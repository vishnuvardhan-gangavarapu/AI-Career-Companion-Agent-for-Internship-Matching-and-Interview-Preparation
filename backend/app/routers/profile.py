from datetime import datetime, timezone
from pathlib import Path
import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
)
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import Resume, ResumeProfile, User
from app.schemas.profile import UpdateProfileRequest


router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"],
)


# =========================================================
# PROFILE IMAGE STORAGE
# =========================================================

BASE_DIR = Path(__file__).resolve().parents[2]

PROFILE_IMAGE_DIR = (
    BASE_DIR / "uploads" / "profile_images"
)

PROFILE_IMAGE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


# =========================================================
# HELPER - GET LATEST ANALYZED PROFILE
# =========================================================

def get_latest_resume_profile(
    db: Session,
    user_id: int,
):
    return (
        db.query(ResumeProfile)
        .join(
            Resume,
            Resume.id == ResumeProfile.resume_id,
        )
        .filter(
            ResumeProfile.user_id == user_id,
            Resume.analysis_status == "completed",
        )
        .order_by(
            Resume.analyzed_at.desc()
        )
        .first()
    )


# =========================================================
# GET PROFILE
# =========================================================

@router.get("")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # =====================================================
    # INTERN PROFILE
    # =====================================================

    if current_user.role == "intern":

        profile = get_latest_resume_profile(
            db=db,
            user_id=current_user.id,
        )

        if profile:

            return {
                "id": profile.id,
                "user_id": profile.user_id,

                "full_name": profile.full_name,
                "email": profile.email,
                "phone": profile.phone,
                "address": profile.address,

                "linkedin_url": profile.linkedin_url,
                "github_url": profile.github_url,

                "professional_summary": (
                    profile.professional_summary
                ),

                "skills": profile.skills or [],
                "technical_skills": (
                    profile.technical_skills or []
                ),
                "soft_skills": (
                    profile.soft_skills or []
                ),

                "education": (
                    profile.education or []
                ),

                "work_experience": (
                    profile.work_experience or []
                ),

                "projects": (
                    profile.projects or []
                ),

                "certifications": (
                    profile.certifications or []
                ),

                "internships": (
                    profile.internships or []
                ),

                "languages": (
                    profile.languages or []
                ),

                "achievements": (
                    profile.achievements or []
                ),

                "publications": (
                    profile.publications or []
                ),

                # IMPORTANT
                # Image is stored in users table
                "profile_image": (
                    current_user.profile_image
                ),

                "role": current_user.role,

                "created_at": profile.created_at,
                "updated_at": profile.updated_at,
            }

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only interns can access the profile",
    )


# =========================================================
# UPDATE PROFILE
# =========================================================

@router.patch("")
def update_profile(
    request: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    update_data = request.model_dump(
        exclude_unset=True,
    )

    if not update_data:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No profile fields were provided "
                "for update"
            ),
        )

    # =====================================================
    # INTERN
    # =====================================================

    if current_user.role == "intern":

        profile = get_latest_resume_profile(
            db=db,
            user_id=current_user.id,
        )

        if not profile:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "No analyzed resume profile found"
                ),
            )

        allowed_fields = {
            "full_name",
            "phone",
            "address",
            "linkedin_url",
            "github_url",
            "professional_summary",
            "skills",
            "technical_skills",
            "soft_skills",
            "education",
            "work_experience",
            "projects",
            "certifications",
            "internships",
            "languages",
            "achievements",
            "publications",
        }

        # -----------------------------------------------
        # UPDATE ONLY SENT FIELDS
        # -----------------------------------------------

        for field, value in update_data.items():

            if field in allowed_fields:

                setattr(
                    profile,
                    field,
                    value,
                )

        current_time = (
            datetime.now(timezone.utc)
            .replace(tzinfo=None)
        )

        profile.updated_at = current_time

        db.commit()
        db.refresh(profile)

        return {
            "message": "Profile updated successfully",

            "profile": {
                "id": profile.id,
                "user_id": profile.user_id,

                "full_name": profile.full_name,
                "email": profile.email,
                "phone": profile.phone,
                "address": profile.address,

                "linkedin_url": profile.linkedin_url,
                "github_url": profile.github_url,

                "professional_summary": (
                    profile.professional_summary
                ),

                "skills": profile.skills or [],

                "technical_skills": (
                    profile.technical_skills or []
                ),

                "soft_skills": (
                    profile.soft_skills or []
                ),

                "education": (
                    profile.education or []
                ),

                "work_experience": (
                    profile.work_experience or []
                ),

                "projects": (
                    profile.projects or []
                ),

                "certifications": (
                    profile.certifications or []
                ),

                "internships": (
                    profile.internships or []
                ),

                "languages": (
                    profile.languages or []
                ),

                "achievements": (
                    profile.achievements or []
                ),

                "publications": (
                    profile.publications or []
                ),

                "profile_image": (
                    current_user.profile_image
                ),

                "created_at": profile.created_at,
                "updated_at": profile.updated_at,
            },
        }

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only interns can update the profile",
    )


# =========================================================
# UPDATE PROFILE IMAGE
# =========================================================

@router.patch("/image")
async def update_profile_image(
    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    # =====================================================
    # CHECK FILE TYPE
    # =====================================================

    if not file.content_type:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image content type is missing",
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid image format. "
                "Only JPG, PNG and WEBP images are allowed."
            ),
        )

    # =====================================================
    # READ FILE
    # =====================================================

    image_data = await file.read()

    if not image_data:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image is empty",
        )

    # =====================================================
    # CHECK FILE SIZE
    # =====================================================

    if len(image_data) > MAX_IMAGE_SIZE:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be 5 MB or less",
        )

    # =====================================================
    # GENERATE UNIQUE FILE NAME
    # =====================================================

    extension = ALLOWED_IMAGE_TYPES[
        file.content_type
    ]

    filename = (
        f"user_{current_user.id}_"
        f"{uuid.uuid4().hex}"
        f"{extension}"
    )

    file_path = (
        PROFILE_IMAGE_DIR / filename
    )

    # =====================================================
    # SAVE IMAGE
    # =====================================================

    try:

        with open(
            file_path,
            "wb",
        ) as image_file:

            image_file.write(
                image_data
            )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Unable to save profile image: {exc}"
            ),
        )

    # =====================================================
    # DELETE OLD IMAGE
    # =====================================================

    old_image = current_user.profile_image

    if old_image:

        try:

            old_filename = (
                Path(old_image).name
            )

            old_file_path = (
                PROFILE_IMAGE_DIR
                / old_filename
            )

            if (
                old_file_path.exists()
                and old_file_path != file_path
            ):

                old_file_path.unlink()

        except Exception:
            # Don't fail the request just because
            # old image cleanup failed.
            pass

    # =====================================================
    # SAVE IMAGE PATH TO DATABASE
    # =====================================================

    current_user.profile_image = (
        f"/uploads/profile_images/{filename}"
    )

    current_user.updated_at = (
        datetime.now(timezone.utc)
        .replace(tzinfo=None)
    )

    db.commit()
    db.refresh(current_user)

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "message": (
            "Profile image updated successfully"
        ),

        "profile_image": (
            current_user.profile_image
        ),

        "user_id": current_user.id,
    }