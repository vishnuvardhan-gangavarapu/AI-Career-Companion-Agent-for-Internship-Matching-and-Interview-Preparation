from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db

from app.models import (
    Internship,
    SavedInternship,
    User,
)


router = APIRouter(
    prefix="/api/internships",
    tags=["Saved Internships"],
)


# =========================================================
# SAVE INTERNSHIP
# =========================================================

@router.post(
    "/{internship_id}/save",
    status_code=status.HTTP_201_CREATED,
)
def save_internship(
    internship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # ONLY INTERNS CAN SAVE
    # -----------------------------------------------------

    if current_user.role != "intern":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can save internships",
        )

    # -----------------------------------------------------
    # VERIFY INTERNSHIP EXISTS
    # -----------------------------------------------------

    internship = (
        db.query(Internship)
        .filter(
            Internship.id == internship_id
        )
        .first()
    )

    if internship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship not found",
        )

    # -----------------------------------------------------
    # CHECK WHETHER THIS USER ALREADY SAVED IT
    #
    # user_id ALWAYS comes from the JWT.
    # React never sends user_id.
    # -----------------------------------------------------

    existing_saved = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id == current_user.id,
            SavedInternship.internship_id == internship.id,
        )
        .first()
    )

    if existing_saved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Internship is already saved",
        )

    # -----------------------------------------------------
    # CREATE USER-SPECIFIC SAVED RECORD
    # -----------------------------------------------------

    saved_internship = SavedInternship(
        user_id=current_user.id,
        internship_id=internship.id,
    )

    db.add(saved_internship)

    try:
        db.commit()
        db.refresh(saved_internship)

    except IntegrityError:
        db.rollback()

        # This can happen if two save requests arrive
        # almost simultaneously and the database unique
        # constraint catches the duplicate.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Internship is already saved",
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save internship",
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "message": "Internship saved successfully",

        "saved_internship": {
            "id": saved_internship.id,

            "saved_id": saved_internship.id,

            "internship_id": internship.id,

            "company_name": internship.company_name,

            "company": internship.company_name,

            "job_title": internship.title,

            "title": internship.title,

            "location": internship.location,

            "duration": internship.duration,

            "work_mode": internship.work_mode,

            "stipend": internship.stipend,

            "start_date": internship.start_date,

            "description": internship.description,

            "eligibility": internship.eligibility,

            "required_skills": (
                internship.required_skills
                if internship.required_skills is not None
                else []
            ),

            "responsibilities": internship.responsibilities,

            "benefits": internship.benefits,

            "application_url": internship.application_url,

            "saved_at": saved_internship.saved_at,
        },
    }


# =========================================================
# GET CURRENT USER'S SAVED INTERNSHIPS
# =========================================================

@router.get("/saved")
def get_saved_internships(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # ONLY INTERNS CAN VIEW SAVED INTERNSHIPS
    # -----------------------------------------------------

    if current_user.role != "intern":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can view saved internships",
        )

    # -----------------------------------------------------
    # GET ONLY THE CURRENT USER'S SAVED RECORDS
    #
    # current_user.id comes from JWT.
    # -----------------------------------------------------

    saved_rows = (
        db.query(
            SavedInternship,
            Internship,
        )
        .join(
            Internship,
            Internship.id == SavedInternship.internship_id,
        )
        .filter(
            SavedInternship.user_id == current_user.id
        )
        .order_by(
            SavedInternship.saved_at.desc()
        )
        .all()
    )

    internships = []

    for saved, internship in saved_rows:

        internships.append(
            {
                # Saved record ID
                "saved_id": saved.id,

                # Internship ID
                "id": internship.id,

                "internship_id": internship.id,

                # Basic information
                "title": internship.title,

                "job_title": internship.title,

                "company_name": internship.company_name,

                "company": internship.company_name,

                "location": internship.location,

                "duration": internship.duration,

                "work_mode": internship.work_mode,

                "stipend": internship.stipend,

                "start_date": internship.start_date,

                # Details
                "description": internship.description,

                "eligibility": internship.eligibility,

                "required_skills": (
                    internship.required_skills
                    if internship.required_skills is not None
                    else []
                ),

                "responsibilities": internship.responsibilities,

                "benefits": internship.benefits,

                "application_url": internship.application_url,

                # Saved timestamp
                "saved_at": saved.saved_at,
            }
        )

    return {
        "message": "Saved internships retrieved successfully",

        "total_saved": len(internships),

        "internships": internships,
    }


# =========================================================
# REMOVE SAVED INTERNSHIP
# =========================================================

@router.delete(
    "/{internship_id}/save"
)
def remove_saved_internship(
    internship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # ONLY INTERNS CAN REMOVE SAVED INTERNSHIPS
    # -----------------------------------------------------

    if current_user.role != "intern":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only interns can remove saved internships",
        )

    # -----------------------------------------------------
    # FIND RECORD BELONGING TO CURRENT USER ONLY
    # -----------------------------------------------------

    saved_internship = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id == current_user.id,
            SavedInternship.internship_id == internship_id,
        )
        .first()
    )

    if saved_internship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship is not saved",
        )

    # -----------------------------------------------------
    # DELETE
    # -----------------------------------------------------

    db.delete(saved_internship)

    try:
        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to remove saved internship",
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "message": (
            "Internship removed from "
            "saved internships successfully"
        ),

        "internship_id": internship_id,
    }