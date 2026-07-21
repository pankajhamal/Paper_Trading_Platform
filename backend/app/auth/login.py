from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.database.connection import get_db
from app.models.users import User
from app.schemas.UserLogin import UserLogin
from app.auth.utils import verify_password
from app.auth.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
def login(user: OAuth2PasswordRequestForm = Depends() , db: Session = Depends(get_db)):

  db_user = db.query(User).filter(User.email == user.username).first()

  if not db_user:
    raise HTTPException(status_code=400, detail="Invalid Credentials")
  
  if not verify_password(user.password, db_user.password):
    raise HTTPException(status_code=400, detail="Invalid Credentials")

  # Block disabled (soft-deleted) accounts from logging in.
  if getattr(db_user, "is_active", True) is False:
    raise HTTPException(status_code=403, detail="This account has been disabled.")

  token = create_access_token(
    data={"user_id": db_user.user_id, "email": db_user.email}
  )

  return{
    "access_token": token,
    "email": db_user.email,
    "full_name": db_user.full_name,
    "avatar_url": db_user.avatar_url,
    "role": db_user.role,
    "token_type": "bearer"
  }