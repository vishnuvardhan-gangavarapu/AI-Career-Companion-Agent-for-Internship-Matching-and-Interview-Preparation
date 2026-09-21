import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
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
    PasswordResetRequest,
)

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    VerifyResetOTPRequest,
    ResetPasswordRequest,
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
# HELPER FUNCTIONS
# =========================================================

def normalize_phone(phone: str) -> str:
    """
    Convert a phone number into digits only.

    Example:
        +91 98765-43210
        becomes:
        919876543210
    """

    return re.sub(r"\D", "", phone)


def find_user_by_identifier(
    db: Session,
    identifier: str,
) -> User | None:
    """
    Find a user using either:
    - Email address
    - Mobile number
    """

    identifier = identifier.strip()

    # -----------------------------------------------------
    # Try email
    # -----------------------------------------------------

    if "@" in identifier:

        return (
            db.query(User)
            .filter(
                func.lower(User.email)
                == identifier.lower()
            )
            .first()
        )

    # -----------------------------------------------------
    # Try mobile number
    # -----------------------------------------------------

    normalized_phone = normalize_phone(
        identifier
    )

    if not normalized_phone:
        return None

    # PostgreSQL:
    # Remove all non-numeric characters from
    # the stored phone number before comparison.
    user = (
        db.query(User)
        .filter(
            func.regexp_replace(
                User.phone,
                r"[^0-9]",
                "",
                "g",
            )
            == normalized_phone
        )
        .first()
    )

    return user


def generate_otp() -> str:
    """
    Generate a random 6-digit OTP.
    """

    return str(
        secrets.randbelow(900000) + 100000
    )


def generate_reset_token() -> str:
    """
    Generate a secure password reset token.
    """

    return secrets.token_urlsafe(48)


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
    # NOTIFICATION
    # =====================================================

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
    # =====================================================

    if resume is None:

        dashboard_type = "default"

        dashboard_path = "/defaultDashboard"

        resume_id = None

        resume_profile_id = None

    else:

        # =================================================
        # STEP 5
        # Check resume_profiles
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
        # Resume exists but not analysed
        # =================================================

        if resume_profile is None:

            dashboard_type = "default"

            dashboard_path = "/defaultDashboard"

            resume_id = resume.id

            resume_profile_id = None

        # =================================================
        # CASE B
        # Resume + profile exists
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
        # Dashboard
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
# UPDATE PROFILE
# =========================================================

@router.patch(
    "/profile",
    status_code=status.HTTP_200_OK,
)
def update_profile(
    request: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the currently logged-in user's:

    - Full name
    - Email
    - Phone number

    The user can only update their own account because
    current_user is obtained from the JWT token.
    """

    # =====================================================
    # CLEAN INPUT
    # =====================================================

    full_name = request.full_name.strip()

    email = request.email.strip().lower()

    phone = request.phone.strip()

    # =====================================================
    # CHECK EMAIL
    # =====================================================

    existing_email = (
        db.query(User)
        .filter(
            func.lower(User.email) == email,
            User.id != current_user.id,
        )
        .first()
    )

    if existing_email:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Email is already registered "
                "by another account."
            ),
        )

    # =====================================================
    # NORMALIZE PHONE
    # =====================================================

    normalized_phone = re.sub(
        r"\D",
        "",
        phone,
    )

    if len(normalized_phone) < 10:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Phone number must contain "
                "at least 10 digits."
            ),
        )

    existing_phone = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            func.regexp_replace(
                User.phone,
                r"[^0-9]",
                "",
                "g",
            ) == normalized_phone,
        )
        .first()
    )

    if existing_phone:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Phone number is already registered "
                "by another account."
            ),
        )

    # =====================================================
    # UPDATE CURRENT USER
    # =====================================================

    current_user.full_name = full_name

    current_user.email = email

    current_user.phone = phone

    current_user.updated_at = (
        datetime.now(timezone.utc)
        .replace(tzinfo=None)
    )

    # =====================================================
    # SAVE
    # =====================================================

    db.commit()

    db.refresh(current_user)

    # =====================================================
    # NOTIFICATION
    # =====================================================

    create_user_notification(
        db=db,

        user_id=current_user.id,

        title="Profile Updated",

        message=(
            "Your InternMatch AI profile information "
            "was updated successfully."
        ),

        notification_type="account",

        related_entity_type="user",

        related_entity_id=current_user.id,
    )

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "success": True,

        "message": (
            "Profile updated successfully."
        ),

        "user": {
            "id": current_user.id,

            "full_name": current_user.full_name,

            "email": current_user.email,

            "phone": current_user.phone,

            "role": current_user.role,

            "profile_image": (
                current_user.profile_image
            ),
        },
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
            detail=(
                "New password must be different "
                "from current password"
            ),
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
# FORGOT PASSWORD - STEP 1
# =========================================================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Start the password reset process.

    The user can provide:
    - Email address
    - Mobile number

    A NEW 6-digit OTP is generated every time.
    """

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = find_user_by_identifier(
        db,
        request.identifier,
    )

    # -----------------------------------------------------
    # User not found
    # -----------------------------------------------------

    if not user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No account found with the provided "
                "email or mobile number."
            ),
        )

    # -----------------------------------------------------
    # Check account status
    # -----------------------------------------------------

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    # -----------------------------------------------------
    # Generate NEW OTP
    # -----------------------------------------------------

    otp = generate_otp()

    # -----------------------------------------------------
    # OTP expires after 5 minutes
    # -----------------------------------------------------

    now = datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )

    otp_expires_at = (
        now + timedelta(minutes=5)
    )

    # -----------------------------------------------------
    # Invalidate previous unverified requests
    # -----------------------------------------------------

    previous_requests = (
        db.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.user_id == user.id,
            PasswordResetRequest.otp_verified == False,
        )
        .all()
    )

    for previous_request in previous_requests:

        previous_request.otp_expires_at = now

    # -----------------------------------------------------
    # Create new password reset request
    # -----------------------------------------------------

    reset_request = PasswordResetRequest(

        user_id=user.id,

        otp=otp,

        otp_expires_at=otp_expires_at,

        reset_token=None,

        reset_token_expires_at=None,

        otp_verified=False,

    )

    db.add(reset_request)

    db.commit()

    db.refresh(reset_request)

    # -----------------------------------------------------
    # Development / Demo response
    # -----------------------------------------------------
    #
    # The OTP is returned because this project currently
    # uses a dummy OTP instead of a real email/SMS service.
    #
    # In production, remove "demo_otp" and send the OTP
    # through email/SMS.
    # -----------------------------------------------------

    return {

        "success": True,

        "message": "OTP generated successfully.",

        "identifier": request.identifier,

        "demo_otp": otp,

        "expires_in": 300,

    }


# =========================================================
# FORGOT PASSWORD - STEP 2
# VERIFY OTP
# =========================================================

@router.post("/verify-reset-otp")
def verify_reset_otp(
    request: VerifyResetOTPRequest,
    db: Session = Depends(get_db),
):
    """
    Verify the OTP entered by the user.
    """

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = find_user_by_identifier(
        db,
        request.identifier,
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found.",
        )

    # -----------------------------------------------------
    # Find latest password reset request
    # -----------------------------------------------------

    reset_request = (
        db.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.user_id == user.id
        )
        .order_by(
            PasswordResetRequest.created_at.desc()
        )
        .first()
    )

    if not reset_request:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No password reset request found. "
                "Please request a new OTP."
            ),
        )

    # -----------------------------------------------------
    # Check if OTP is already verified
    # -----------------------------------------------------

    if reset_request.otp_verified:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This OTP has already been verified. "
                "Please request a new OTP."
            ),
        )

    # -----------------------------------------------------
    # Check OTP expiry
    # -----------------------------------------------------

    now = datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )

    if reset_request.otp_expires_at < now:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "OTP has expired. "
                "Please request a new OTP."
            ),
        )

    # -----------------------------------------------------
    # Validate OTP
    # -----------------------------------------------------

    if reset_request.otp != request.otp:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP.",
        )

    # -----------------------------------------------------
    # Generate reset token
    # -----------------------------------------------------

    reset_token = generate_reset_token()

    reset_request.otp_verified = True

    reset_request.reset_token = reset_token

    reset_request.reset_token_expires_at = (
        now + timedelta(minutes=10)
    )

    db.commit()

    db.refresh(reset_request)

    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return {

        "success": True,

        "message": "OTP verified successfully.",

        "reset_token": reset_token,

        "expires_in": 600,

    }


# =========================================================
# FORGOT PASSWORD - STEP 3
# RESET PASSWORD
# =========================================================

@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Reset the user's password after successful
    OTP verification.
    """

    # -----------------------------------------------------
    # Validate password confirmation
    # -----------------------------------------------------

    request.validate_password_match()

    # -----------------------------------------------------
    # Find reset request
    # -----------------------------------------------------

    reset_request = (
        db.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.reset_token
            == request.reset_token,

            PasswordResetRequest.otp_verified
            == True,
        )
        .first()
    )

    if not reset_request:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    # -----------------------------------------------------
    # Check reset token expiry
    # -----------------------------------------------------

    now = datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )

    if (
        not reset_request.reset_token_expires_at
        or reset_request.reset_token_expires_at < now
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Reset token has expired. "
                "Please start the password reset process again."
            ),
        )

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == reset_request.user_id
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    # -----------------------------------------------------
    # Prevent using the same password
    # -----------------------------------------------------

    if verify_password(
        request.new_password,
        user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "New password must be different "
                "from your old password."
            ),
        )

    # -----------------------------------------------------
    # Hash new password
    # -----------------------------------------------------

    user.password_hash = hash_password(
        request.new_password
    )

    user.updated_at = now

    # -----------------------------------------------------
    # Invalidate reset token
    # -----------------------------------------------------

    reset_request.reset_token = None

    reset_request.reset_token_expires_at = None

    db.commit()

    db.refresh(user)

    # =====================================================
    # PASSWORD RESET NOTIFICATION
    # =====================================================

    create_user_notification(
        db=db,

        user_id=user.id,

        title="Password Reset Successful",

        message=(
            "Your InternMatch AI account password "
            "was reset successfully."
        ),

        notification_type="security",

        related_entity_type="user",

        related_entity_id=user.id,
    )

    return {

        "success": True,

        "message": (
            "Password reset successfully. "
            "You can now log in with your new password."
        ),

    }


# =========================================================
# LOGOUT
# =========================================================

@router.post("/logout")
def logout(
    current_user: User = Depends(
        get_current_user
    ),
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