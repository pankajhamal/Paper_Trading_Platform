from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str