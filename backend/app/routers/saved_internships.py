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
    Internship,
    SavedInternship,
    User,
)

router = APIRouter(
    prefix="/api/internships",
    tags=["Saved Internships"],
)

@router.post(
    "/{internship_id}/save",
    status_code=status.HTTP_201_CREATED,
)
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
            detail=(
                "Only interns can save "
                "internships"
            ),
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

    existing_saved = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id
            == current_user.id,
            SavedInternship.internship_id
            == internship_id,
        )
        .first()
    )

    if existing_saved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Internship is already saved"
            ),
        )

    saved_internship = SavedInternship(
        user_id=current_user.id,
        internship_id=internship.id,
    )

    db.add(saved_internship)
    db.commit()
    db.refresh(saved_internship)

    return {
        "message": (
            "Internship saved successfully"
        ),
        "saved_internship": {
            "id": saved_internship.id,
            "internship_id": internship.id,
            "company_name": internship.company_name,
            "job_title": internship.title,
            "location": internship.location,
            "saved_at": saved_internship.saved_at,
        },
    }

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
            detail=(
                "Only interns can view "
                "saved internships"
            ),
        )

    saved_internships = (
        db.query(SavedInternship)
        .join(
            Internship,
            Internship.id
            == SavedInternship.internship_id,
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

    result = []

    for saved in saved_internships:

        internship = (
            saved.internship
            if hasattr(
                saved,
                "internship"
            )
            else None
        )

        # If relationship is not defined,
        # get internship manually.
        if internship is None:

            internship = (
                db.query(Internship)
                .filter(
                    Internship.id
                    == saved.internship_id
                )
                .first()
            )

        if not internship:
            continue

        result.append(
            {
                "saved_id": saved.id,

                "internship_id": (
                    internship.id
                ),

                "company_name": (
                    internship.company_name
                ),

                "job_title": (
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

                "saved_at": (
                    saved.saved_at
                ),
            }
        )

    return {
        "message": (
            "Saved internships "
            "retrieved successfully"
        ),

        "total_saved": len(result),

        "internships": result,
    }

@router.delete(
    "/{internship_id}/save"
)
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
            detail=(
                "Only interns can remove "
                "saved internships"
            ),
        )

    saved_internship = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id == current_user.id,

            SavedInternship.internship_id == internship_id,
        )
        .first()
    )

    if not saved_internship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Internship is not saved"
            ),
        )

    db.delete(saved_internship)
    db.commit()

    return {
        "message": (
            "Internship removed from "
            "saved internships successfully"
        ),
        "internship_id": internship_id,
    }