from pydantic import BaseModel, EmailStr, Field, field_validator

class RegisterRequest(BaseModel):

    full_name: str = Field(
        min_length=2,
        max_length=150
    )

    email: EmailStr

    phone: str = Field(
        min_length=10,
        max_length=20
    )

    password: str = Field(
        min_length=8,
        max_length=72
    )

    confirm_password: str = Field(
        min_length=8,
        max_length=72
    )

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:

        value = value.strip()

        if not value:
            raise ValueError(
                "Full name is required"
            )

        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:

        value = value.strip()

        allowed = set(
            "0123456789+- "
        )

        if any(
            character not in allowed
            for character in value
        ):
            raise ValueError(
                "Invalid phone number"
            )

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 10:
            raise ValueError(
                "Phone number must contain at least 10 digits"
            )

        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:

        if not any(
            character.isupper()
            for character in value
        ):
            raise ValueError(
                "Password must contain at least one uppercase letter"
            )

        if not any(
            character.islower()
            for character in value
        ):
            raise ValueError(
                "Password must contain at least one lowercase letter"
            )

        if not any(
            character.isdigit()
            for character in value
        ):
            raise ValueError(
                "Password must contain at least one number"
            )

        return value

    def validate_password_match(self) -> None:

        if self.password != self.confirm_password:

            raise ValueError(
                "Passwords do not match"
            )

class LoginRequest(BaseModel):

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=72
    )

class UpdateProfileRequest(BaseModel):
    """
    Used by the logged-in user to update:

    - Full Name
    - Email Address
    - Phone Number

    The account role is intentionally NOT included
    because the role is controlled by the system.
    """

    full_name: str = Field(
        min_length=2,
        max_length=150
    )

    email: EmailStr

    phone: str = Field(
        min_length=10,
        max_length=20
    )

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:

        value = value.strip()

        if not value:
            raise ValueError(
                "Full name is required"
            )

        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:

        value = value.strip()

        allowed = set(
            "0123456789+- "
        )

        if any(
            character not in allowed
            for character in value
        ):
            raise ValueError(
                "Invalid phone number"
            )

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 10:
            raise ValueError(
                "Phone number must contain at least 10 digits"
            )

        return value

class ChangePasswordRequest(BaseModel):

    current_password: str

    new_password: str

    confirm_password: str

    def validate_password_match(self):

        if (
            self.new_password
            != self.confirm_password
        ):

            from fastapi import (
                HTTPException,
                status,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New passwords do not match",
            )

class ForgotPasswordRequest(BaseModel):
    """
    User can enter either:

    - Email address
    - Mobile number
    """

    identifier: str = Field(
        min_length=3,
        max_length=150
    )

    @field_validator("identifier")
    @classmethod
    def validate_identifier(
        cls,
        value: str
    ) -> str:

        value = value.strip()

        if not value:
            raise ValueError(
                "Email address or mobile number is required"
            )

        return value

class VerifyResetOTPRequest(BaseModel):
    """
    Verifies the 6-digit OTP generated during
    the forgot-password process.
    """

    identifier: str = Field(
        min_length=3,
        max_length=150
    )

    otp: str = Field(
        min_length=6,
        max_length=6
    )

    @field_validator("identifier")
    @classmethod
    def validate_identifier(
        cls,
        value: str
    ) -> str:

        value = value.strip()

        if not value:
            raise ValueError(
                "Email address or mobile number is required"
            )

        return value

    @field_validator("otp")
    @classmethod
    def validate_otp(
        cls,
        value: str
    ) -> str:

        if not value.isdigit():
            raise ValueError(
                "OTP must contain only 6 digits"
            )

        if len(value) != 6:
            raise ValueError(
                "OTP must contain exactly 6 digits"
            )

        return value

class ResetPasswordRequest(BaseModel):
    """
    Used after successful OTP verification.
    """

    reset_token: str = Field(
        min_length=1
    )

    new_password: str = Field(
        min_length=8,
        max_length=72
    )

    confirm_password: str = Field(
        min_length=8,
        max_length=72
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(
        cls,
        value: str
    ) -> str:

        if not any(
            character.isupper()
            for character in value
        ):
            raise ValueError(
                "Password must contain at least one uppercase letter"
            )

        if not any(
            character.islower()
            for character in value
        ):
            raise ValueError(
                "Password must contain at least one lowercase letter"
            )

        if not any(
            character.isdigit()
            for character in value
        ):
            raise ValueError(
                "Password must contain at least one number"
            )

        return value

    def validate_password_match(self) -> None:

        if (
            self.new_password
            != self.confirm_password
        ):

            from fastapi import (
                HTTPException,
                status,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New passwords do not match",
            )

class DeleteAccountRequest(BaseModel):
    password: str