from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)

from app.database.connection import get_db

from app.models import (
    User,
    Resume,
    ResumeProfile,
)

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    DeleteAccountRequest,
)

# =========================================================
# NOTIFICATION SERVICE
# =========================================================

from app.services.notification_service import (
    create_user_notification,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):

    # -----------------------------------------------------
    # Validate password confirmation
    # -----------------------------------------------------

    request.validate_password_match()

    # -----------------------------------------------------
    # Check email
    # -----------------------------------------------------

    existing_email = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if existing_email:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    # -----------------------------------------------------
    # Check phone
    # -----------------------------------------------------

    existing_phone = (
        db.query(User)
        .filter(User.phone == request.phone)
        .first()
    )

    if existing_phone:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number is already registered",
        )

    # -----------------------------------------------------
    # Hash password
    # -----------------------------------------------------

    hashed_password = hash_password(
        request.password
    )

    # -----------------------------------------------------
    # Create user
    # -----------------------------------------------------

    user = User(
        full_name=request.full_name,
        email=request.email,
        phone=request.phone,
        password_hash=hashed_password,
        role="intern",
        is_active=True,
    )

    db.add(user)

    db.commit()

    db.refresh(user)

    # =====================================================
    # NOTIFICATIONS
    # =====================================================

    # -----------------------------------------------------
    # Notification for the newly registered intern
    # -----------------------------------------------------

    create_user_notification(
        db=db,

        user_id=user.id,

        title="Welcome to InternMatch AI",

        message=(
            f"Welcome {user.full_name}! "
            "Your InternMatch AI account has been created "
            "successfully."
        ),

        notification_type="account",

        related_entity_type="user",

        related_entity_id=user.id,
    )

    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return {
        "message": "Registration successful",

        "user": {
            "id": user.id,

            "full_name": user.full_name,

            "email": user.email,

            "phone": user.phone,

            "role": user.role,
        },
    }


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):

    # =====================================================
    # STEP 1
    # Find user
    # =====================================================

    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # =====================================================
    # STEP 2
    # Verify password
    # =====================================================

    if not verify_password(
        request.password,
        user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # =====================================================
    # STEP 3
    # Check account status
    # =====================================================

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # =====================================================
    # STEP 4
    # CHECK RESUME
    #
    # Find a resume belonging to this user.
    # =====================================================

    resume = (
        db.query(Resume)
        .filter(
            Resume.user_id == user.id
        )
        .order_by(
            Resume.id.desc()
        )
        .first()
    )

    # =====================================================
    # DEFAULT DASHBOARD
    #
    # If the user has NO resume:
    #
    # /defaultDashboard
    #
    # DefaultSidebar
    # =====================================================

    if resume is None:

        dashboard_type = "default"

        dashboard_path = "/defaultDashboard"

        resume_id = None

        resume_profile_id = None

    else:

        # =================================================
        # STEP 5
        # Resume exists.
        #
        # Now check resume_profiles.
        # =================================================

        resume_profile = (
            db.query(ResumeProfile)
            .filter(
                ResumeProfile.resume_id == resume.id
            )
            .first()
        )

        # =================================================
        # CASE A
        #
        # Resume exists
        # BUT it has not been analysed.
        #
        # No resume_profiles row.
        #
        # → Default Dashboard
        # =================================================

        if resume_profile is None:

            dashboard_type = "default"

            dashboard_path = "/defaultDashboard"

            resume_id = resume.id

            resume_profile_id = None

        # =================================================
        # CASE B
        #
        # Resume exists
        # AND resume_profiles exists.
        #
        # → Professional/User Dashboard
        # =================================================

        else:

            dashboard_type = "professional"

            dashboard_path = "/userDashboard"

            resume_id = resume.id

            resume_profile_id = resume_profile.id

    # =====================================================
    # STEP 6
    # CREATE JWT
    # =====================================================

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    # =====================================================
    # STEP 7
    # LOGIN RESPONSE
    # =====================================================

    return {

        "message": "Login successful",

        # -------------------------------------------------
        # Authentication
        # -------------------------------------------------

        "access_token": access_token,

        "token_type": "bearer",

        # -------------------------------------------------
        # User
        # -------------------------------------------------

        "user": {
            "id": user.id,

            "full_name": user.full_name,

            "email": user.email,

            "phone": user.phone,

            "role": user.role,
        },

        # -------------------------------------------------
        # Dashboard decision
        # -------------------------------------------------

        "dashboard": {

            "type": dashboard_type,

            "path": dashboard_path,

        },

        # -------------------------------------------------
        # Resume information
        # -------------------------------------------------

        "resume_id": resume_id,

        "resume_profile_id": resume_profile_id,

    }


# =========================================================
# CURRENT USER
# =========================================================

@router.get("/me")
def get_current_user_info(
    current_user: User = Depends(
        get_current_user
    ),
):

    return {

        "id": current_user.id,

        "full_name": current_user.full_name,

        "email": current_user.email,

        "phone": current_user.phone,

        "role": current_user.role,

        "profile_image": (
            current_user.profile_image
        ),

    }


# =========================================================
# CHANGE PASSWORD
# =========================================================

@router.put(
    "/change-password",
    status_code=status.HTTP_200_OK,
)
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    request.validate_password_match()

    # -----------------------------------------------------
    # Check current password
    # -----------------------------------------------------

    if not verify_password(
        request.current_password,
        current_user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # -----------------------------------------------------
    # Prevent same password
    # -----------------------------------------------------

    if verify_password(
        request.new_password,
        current_user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    # -----------------------------------------------------
    # Hash new password
    # -----------------------------------------------------

    current_user.password_hash = hash_password(
        request.new_password
    )

    db.commit()

    db.refresh(current_user)

    # =====================================================
    # PASSWORD CHANGE NOTIFICATION
    # =====================================================

    create_user_notification(
        db=db,

        user_id=current_user.id,

        title="Password Changed",

        message=(
            "Your InternMatch AI account password "
            "was changed successfully."
        ),

        notification_type="security",

        related_entity_type="user",

        related_entity_id=current_user.id,
    )

    return {
        "message": "Password changed successfully"
    }


# =========================================================
# FORGOT PASSWORD
# =========================================================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):

    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    # -----------------------------------------------------
    # Do not reveal whether email exists
    # -----------------------------------------------------

    if not user:

        return {
            "message": (
                "If an account exists with this email, "
                "password reset instructions are available."
            )
        }

    return {
        "message": (
            "Password reset instructions have been generated. "
            "Please continue with password reset."
        )
    }


# =========================================================
# LOGOUT
# =========================================================

@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
):

    return {
        "message": "Logout successful"
    }


# =========================================================
# DELETE ACCOUNT
# =========================================================

@router.delete(
    "/account",
    status_code=status.HTTP_200_OK,
)
def delete_account(
    request: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # -----------------------------------------------------
    # Verify password
    # -----------------------------------------------------

    if not verify_password(
        request.password,
        current_user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password",
        )

    # -----------------------------------------------------
    # Delete account
    # -----------------------------------------------------

    db.delete(current_user)

    db.commit()

    return {
        "message": "Account deleted successfully"
    }