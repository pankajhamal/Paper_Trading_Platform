from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    # Match the min-length enforced by the change-password flow (was unenforced here).
    password: str = Field(min_length=8)