from pydantic import BaseModel, EmailStr, Field


class ForgotPasswordRequest(BaseModel):
    """Step 1: user asks for a reset code to be emailed to them."""
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    """Step 2 (optional pre-check): confirm the code is valid before showing the
    new-password form. Does not consume the code."""
    email: EmailStr
    otp: str = Field(min_length=4, max_length=10)


class ResetPasswordRequest(BaseModel):
    """Step 3: submit the code together with the new password."""
    email: EmailStr
    otp: str = Field(min_length=4, max_length=10)
    new_password: str = Field(min_length=8, max_length=128)
