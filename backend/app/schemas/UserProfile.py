from typing import Optional
from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    """Editable profile fields. All optional so the client can send a partial update."""
    full_name: Optional[str] = Field(default=None, max_length=120)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
