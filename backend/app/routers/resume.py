import hashlib
import os
import uuid

from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db

from app.models import (
    Resume,
    ResumeProfile,
    User,
)

from app.services.groq_parser import (
    extract_resume_with_groq,
)

from app.services.regex_parser import (
    parse_with_regex,
)

from app.services.resume_merger import (
    merge_resume_data,
)

from app.services.resume_text_extractor import (
    extract_resume_text,
)

# ============================================================
# NOTIFICATION SERVICE
# ============================================================

from app.services.notification_service import (
    create_user_notification,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/resumes",
    tags=["Resume"],
)


# ============================================================
# CONFIGURATION
# ============================================================

UPLOAD_DIR = "uploads/resumes"

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
}

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


# ============================================================
# HELPERS
# ============================================================


def utc_now():
    """
    Return current UTC time without timezone information.

    This matches the existing database behavior used by the
    project.
    """

    return datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )


# ============================================================
# GET USER RESUME
# ============================================================


def get_user_resume(
    resume_id: int,
    current_user: User,
    db: Session,
):
    """
    Get a resume only if it belongs to the logged-in user.
    """

    resume = (
        db.query(Resume)

        .filter(
            Resume.id == resume_id,

            Resume.user_id
            == current_user.id,
        )

        .first()
    )

    if not resume:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail="Resume not found",
        )

    return resume


# ============================================================
# SERIALIZE PROFILE
# ============================================================


def serialize_profile(
    profile: ResumeProfile,
):
    """
    Convert ResumeProfile SQLAlchemy object
    into JSON-safe data.
    """

    if not profile:

        return None

    return {

        "id": profile.id,

        "full_name": profile.full_name,

        "email": profile.email,

        "phone": profile.phone,

        "address": profile.address,

        "linkedin_url": (
            profile.linkedin_url
        ),

        "github_url": (
            profile.github_url
        ),

        "professional_summary": (
            profile.professional_summary
        ),

        "skills": (
            profile.skills or []
        ),

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

        "created_at": (
            profile.created_at
        ),

        "updated_at": (
            profile.updated_at
        ),
    }


# ============================================================
# UPLOAD RESUME
# ============================================================


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
)
def upload_resume(
    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Upload a resume.

    Uploading stores the physical resume.

    AI analysis is performed separately through:

        POST /api/resumes/{resume_id}/analyze
    """

    # ========================================================
    # USER VALIDATION
    # ========================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,

            detail=(
                "Only interns can upload resumes"
            ),
        )

    # ========================================================
    # FILE NAME VALIDATION
    # ========================================================

    if not file.filename:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,

            detail="File name is required",
        )

    original_filename = file.filename

    extension = os.path.splitext(
        original_filename
    )[1].lower()

    # ========================================================
    # FILE TYPE VALIDATION
    # ========================================================

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(
                "Only PDF and DOCX files are allowed"
            ),
        )

    # ========================================================
    # READ FILE
    # ========================================================

    file_content = file.file.read()

    if not file_content:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Uploaded file is empty",
        )

    # ========================================================
    # FILE SIZE
    # ========================================================

    if len(file_content) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Maximum resume size is 5 MB",
        )

    # ========================================================
    # HASH
    # ========================================================

    file_hash = hashlib.sha256(
        file_content
    ).hexdigest()

    # ========================================================
    # CREATE UPLOAD DIRECTORY
    # ========================================================

    os.makedirs(
        UPLOAD_DIR,
        exist_ok=True,
    )

    # ========================================================
    # CREATE UNIQUE STORED FILE NAME
    # ========================================================

    stored_filename = (
        f"{current_user.id}_"
        f"{uuid.uuid4().hex}"
        f"{extension}"
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        stored_filename,
    )

    # ========================================================
    # CHECK DUPLICATE FILE
    # ========================================================

    existing_resume = (
        db.query(Resume)

        .filter(
            Resume.user_id
            == current_user.id,

            Resume.file_hash
            == file_hash,
        )

        .first()
    )

    # ========================================================
    # SAVE PHYSICAL FILE
    # ========================================================

    try:

        with open(
            file_path,
            "wb",
        ) as output_file:

            output_file.write(
                file_content
            )

        # ====================================================
        # REMOVE OLD DUPLICATE RECORD
        # ====================================================

        if existing_resume:

            old_file_path = (
                existing_resume.file_path
            )

            db.delete(
                existing_resume
            )

            db.flush()

            if (
                old_file_path

                and os.path.exists(
                    old_file_path
                )
            ):

                os.remove(
                    old_file_path
                )

        # ====================================================
        # CREATE NEW RESUME RECORD
        # ====================================================

        resume = Resume(

            user_id=(
                current_user.id
            ),

            file_name=(
                original_filename
            ),

            file_type=(
                extension.replace(
                    ".",
                    "",
                )
            ),

            file_path=(
                file_path
            ),

            file_size=(
                len(file_content)
            ),

            file_hash=(
                file_hash
            ),

            analysis_status=(
                "uploaded"
            ),
        )

        db.add(
            resume
        )

        db.commit()

        db.refresh(
            resume
        )

        # ====================================================
        # RESUME UPLOAD NOTIFICATION
        # ====================================================

        create_user_notification(

            db=db,

            user_id=(
                current_user.id
            ),

            title=(
                "Resume Uploaded"
            ),

            message=(
                f"Your resume "
                f"'{resume.file_name}' "
                "has been uploaded successfully. "
                "You can now analyze it to create "
                "your professional profile."
            ),

            notification_type=(
                "resume_uploaded"
            ),

            related_entity_type=(
                "resume"
            ),

            related_entity_id=(
                resume.id
            ),
        )

    except Exception as exc:

        db.rollback()

        if os.path.exists(
            file_path
        ):

            os.remove(
                file_path
            )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Unable to save resume: "
                f"{str(exc)}"
            ),
        )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "message": (
            "Resume uploaded successfully"
        ),

        "resume": {

            "id": (
                resume.id
            ),

            "file_name": (
                resume.file_name
            ),

            "file_type": (
                resume.file_type
            ),

            "file_size": (
                resume.file_size
            ),

            "analysis_status": (
                resume.analysis_status
            ),

            "uploaded_at": (
                resume.uploaded_at
            ),

            "analyzed_at": (
                resume.analyzed_at
            ),
        },

        "resume_id": (
            resume.id
        ),

        "filename": (
            resume.file_name
        ),

        "file_type": (
            resume.file_type
        ),

        "file_size": (
            resume.file_size
        ),

        "analysis_status": (
            resume.analysis_status
        ),

        "duplicate_replaced": (
            existing_resume is not None
        ),
    }


# ============================================================
# COMPLETE RESUME ANALYSIS
# ============================================================


@router.post(
    "/{resume_id}/analyze",
)
def analyze_resume(
    resume_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    COMPLETE RESUME ANALYSIS PIPELINE.

    This endpoint intentionally performs a FRESH analysis
    EVERY time it is called.

    Analyse button:

        POST /api/resumes/{id}/analyze

    Re-analyse button:

        POST /api/resumes/{id}/analyze

    BOTH use this exact same pipeline.

    Pipeline:

        Original File
             ↓
        Text Extraction
             ↓
        Regex Parsing
             ↓
        Groq LLM Parsing
             ↓
        Merge Results
             ↓
        Delete Old Profile
             ↓
        Create New Profile
             ↓
        Save Database
             ↓
        Notification
    """

    # ========================================================
    # 1. USER VALIDATION
    # ========================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,

            detail=(
                "Only interns can analyze resumes"
            ),
        )

    # ========================================================
    # 2. FIND RESUME
    # ========================================================

    resume = get_user_resume(

        resume_id=resume_id,

        current_user=current_user,

        db=db,
    )

    # ========================================================
    # 3. CHECK PHYSICAL FILE
    # ========================================================

    if not resume.file_path:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail=(
                "Resume file path is missing"
            ),
        )

    if not os.path.exists(
        resume.file_path
    ):

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail=(
                "Resume file not found"
            ),
        )

    # ========================================================
    # 4. PREVENT CONCURRENT ANALYSIS
    # ========================================================

    if str(
        resume.analysis_status
    ).lower() == "analyzing":

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,

            detail=(
                "Resume analysis is already in progress"
            ),
        )

    try:

        # ====================================================
        # STEP 1
        # MARK AS ANALYZING
        # ====================================================

        resume.analysis_status = (
            "analyzing"
        )

        db.commit()

        # ====================================================
        # STEP 2
        # FRESH TEXT EXTRACTION
        # ====================================================

        extracted_text = (
            extract_resume_text(
                resume.file_path,

                resume.file_type,
            )
        )

        if not extracted_text:

            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),

                detail=(
                    "No readable text found in resume"
                ),
            )

        extracted_text = (
            extracted_text.strip()
        )

        if not extracted_text:

            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),

                detail=(
                    "No readable text found in resume"
                ),
            )

        # ====================================================
        # SAVE NEW EXTRACTED TEXT
        # ====================================================

        resume.extracted_text = (
            extracted_text
        )

        db.commit()

        # ====================================================
        # STEP 3
        # FRESH REGEX ANALYSIS
        # ====================================================

        regex_data = (
            parse_with_regex(
                extracted_text
            )
        )

        if not isinstance(
            regex_data,
            dict,
        ):

            regex_data = {}

        # ====================================================
        # STEP 4
        # FRESH GROQ ANALYSIS
        # ====================================================

        llm_data = (
            extract_resume_with_groq(
                extracted_text
            )
        )

        if not isinstance(
            llm_data,
            dict,
        ):

            llm_data = {}

        # ====================================================
        # STEP 5
        # MERGE REGEX + GROQ
        # ====================================================

        merged_data = (
            merge_resume_data(
                regex_data,

                llm_data,
            )
        )

        if not isinstance(
            merged_data,
            dict,
        ):

            merged_data = {}

        # ====================================================
        # STEP 6
        # DELETE OLD PROFILE
        # ====================================================

        old_profile = (
            db.query(
                ResumeProfile
            )

            .filter(
                ResumeProfile.resume_id
                == resume.id
            )

            .first()
        )

        if old_profile:

            db.delete(
                old_profile
            )

            db.flush()

        # ====================================================
        # STEP 7
        # CREATE COMPLETELY NEW PROFILE
        # ====================================================

        profile = ResumeProfile(

            resume_id=(
                resume.id
            ),

            user_id=(
                current_user.id
            ),

            full_name=(
                merged_data.get(
                    "full_name"
                )
            ),

            email=(
                merged_data.get(
                    "email"
                )
            ),

            phone=(
                merged_data.get(
                    "phone"
                )
            ),

            address=(
                merged_data.get(
                    "address"
                )
            ),

            linkedin_url=(
                merged_data.get(
                    "linkedin"
                )
            ),

            github_url=(
                merged_data.get(
                    "github"
                )
            ),

            professional_summary=(
                merged_data.get(
                    "professional_summary"
                )
            ),

            skills=(
                merged_data.get(
                    "skills",
                    [],
                )
            ),

            technical_skills=(
                merged_data.get(
                    "technical_skills",
                    [],
                )
            ),

            soft_skills=(
                merged_data.get(
                    "soft_skills",
                    [],
                )
            ),

            education=(
                merged_data.get(
                    "education",
                    [],
                )
            ),

            work_experience=(
                merged_data.get(
                    "work_experience",
                    [],
                )
            ),

            projects=(
                merged_data.get(
                    "projects",
                    [],
                )
            ),

            certifications=(
                merged_data.get(
                    "certifications",
                    [],
                )
            ),

            internships=(
                merged_data.get(
                    "internships",
                    [],
                )
            ),

            languages=(
                merged_data.get(
                    "languages",
                    [],
                )
            ),

            achievements=(
                merged_data.get(
                    "achievements",
                    [],
                )
            ),

            publications=(
                merged_data.get(
                    "publications",
                    [],
                )
            ),
        )

        db.add(
            profile
        )

        # ====================================================
        # STEP 8
        # UPDATE STATUS
        # ====================================================

        current_time = (
            utc_now()
        )

        profile.updated_at = (
            current_time
        )

        resume.analysis_status = (
            "completed"
        )

        resume.analyzed_at = (
            current_time
        )

        # ====================================================
        # STEP 9
        # FINAL DATABASE COMMIT
        # ====================================================

        db.commit()

        db.refresh(
            resume
        )

        db.refresh(
            profile
        )

        # ====================================================
        # RESUME ANALYSIS COMPLETE NOTIFICATION
        # ====================================================

        create_user_notification(

            db=db,

            user_id=(
                current_user.id
            ),

            title=(
                "Resume Analysis Complete"
            ),

            message=(
                "Your resume has been analyzed "
                "successfully. Your professional "
                "profile has been updated and is "
                "ready to use."
            ),

            notification_type=(
                "resume_analyzed"
            ),

            related_entity_type=(
                "resume"
            ),

            related_entity_id=(
                resume.id
            ),
        )

        # ====================================================
        # STEP 10
        # RETURN NEW ANALYSIS
        # ====================================================

        return {

            "success": True,

            "message": (
                "Resume analyzed successfully "
                "using fresh extraction, Regex "
                "and Groq AI."
            ),

            "resume_id": (
                resume.id
            ),

            "analysis_status": (
                resume.analysis_status
            ),

            "profile_id": (
                profile.id
            ),

            "parsed_data": (
                merged_data
            ),

            "profile": (
                serialize_profile(
                    profile
                )
            ),
        }

    # ========================================================
    # EXPECTED HTTP ERROR
    # ========================================================

    except HTTPException as exc:

        db.rollback()

        try:

            resume.analysis_status = (
                "failed"
            )

            db.commit()

        except Exception:

            db.rollback()

        raise exc

    # ========================================================
    # UNEXPECTED ERROR
    # ========================================================

    except Exception as exc:

        db.rollback()

        # ----------------------------------------------------
        # Mark analysis as failed
        # ----------------------------------------------------

        try:

            failed_resume = (
                db.query(
                    Resume
                )

                .filter(
                    Resume.id
                    == resume_id,

                    Resume.user_id
                    == current_user.id,
                )

                .first()
            )

            if failed_resume:

                failed_resume.analysis_status = (
                    "failed"
                )

                db.commit()

        except Exception:

            db.rollback()

        raise HTTPException(

            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Resume analysis failed: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# GET MY RESUMES
# ============================================================


@router.get("")
def get_my_resumes(
    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return all resumes belonging to
    the logged-in intern.
    """

    # ========================================================
    # USER VALIDATION
    # ========================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,

            detail=(
                "Only interns can access resumes"
            ),
        )

    # ========================================================
    # GET RESUMES
    # ========================================================

    resumes = (
        db.query(Resume)

        .filter(
            Resume.user_id
            == current_user.id
        )

        .order_by(
            Resume.uploaded_at.desc()
        )

        .all()
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "count": len(
            resumes
        ),

        "resumes": [

            {

                "id": (
                    resume.id
                ),

                "file_name": (
                    resume.file_name
                ),

                "file_type": (
                    resume.file_type
                ),

                "file_size": (
                    resume.file_size
                ),

                "analysis_status": (
                    resume.analysis_status
                ),

                "uploaded_at": (
                    resume.uploaded_at
                ),

                "analyzed_at": (
                    resume.analyzed_at
                ),
            }

            for resume in resumes
        ],
    }


# ============================================================
# GET SINGLE RESUME + PROFILE
# ============================================================


@router.get(
    "/{resume_id}"
)
def get_resume_details(
    resume_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return resume information and
    latest generated profile.
    """

    # ========================================================
    # USER VALIDATION
    # ========================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,

            detail=(
                "Only interns can access resumes"
            ),
        )

    # ========================================================
    # FIND RESUME
    # ========================================================

    resume = get_user_resume(

        resume_id=resume_id,

        current_user=current_user,

        db=db,
    )

    # ========================================================
    # FIND PROFILE
    # ========================================================

    profile = (
        db.query(
            ResumeProfile
        )

        .filter(
            ResumeProfile.resume_id
            == resume.id
        )

        .first()
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "resume": {

            "id": (
                resume.id
            ),

            "file_name": (
                resume.file_name
            ),

            "file_type": (
                resume.file_type
            ),

            "file_size": (
                resume.file_size
            ),

            "analysis_status": (
                resume.analysis_status
            ),

            "uploaded_at": (
                resume.uploaded_at
            ),

            "analyzed_at": (
                resume.analyzed_at
            ),

            "extracted_text": (
                resume.extracted_text
            ),
        },

        "profile": (
            serialize_profile(
                profile
            )
        ),
    }


# ============================================================
# DELETE RESUME
# ============================================================


@router.delete(
    "/{resume_id}",
    status_code=status.HTTP_200_OK,
)
def delete_resume(
    resume_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Delete resume and associated profile.
    """

    # ========================================================
    # USER VALIDATION
    # ========================================================

    if current_user.role != "intern":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,

            detail=(
                "Only interns can delete resumes"
            ),
        )

    # ========================================================
    # FIND RESUME
    # ========================================================

    resume = get_user_resume(

        resume_id=resume_id,

        current_user=current_user,

        db=db,
    )

    # ========================================================
    # SAVE VALUES BEFORE DELETE
    # ========================================================

    old_file_path = (
        resume.file_path
    )

    deleted_resume_name = (
        resume.file_name
    )

    deleted_resume_id = (
        resume.id
    )

    try:

        # ====================================================
        # DELETE DATABASE RECORD
        # ====================================================

        db.delete(
            resume
        )

        db.commit()

        # ====================================================
        # RESUME DELETE NOTIFICATION
        # ====================================================

        create_user_notification(

            db=db,

            user_id=(
                current_user.id
            ),

            title=(
                "Resume Deleted"
            ),

            message=(
                f"Your resume "
                f"'{deleted_resume_name}' "
                "has been deleted successfully."
            ),

            notification_type=(
                "resume_deleted"
            ),

            related_entity_type=(
                "resume"
            ),

            related_entity_id=(
                deleted_resume_id
            ),
        )

        # ====================================================
        # DELETE PHYSICAL FILE
        # ====================================================

        if (
            old_file_path

            and os.path.exists(
                old_file_path
            )
        ):

            os.remove(
                old_file_path
            )

    except Exception as exc:

        db.rollback()

        raise HTTPException(

            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Unable to delete resume: "
                f"{str(exc)}"
            ),
        )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "success": True,

        "message": (
            "Resume deleted successfully"
        ),

        "resume_id": (
            resume_id
        ),
    }