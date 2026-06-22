from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.schemas.UserLogin import UserLogin
from app.auth.utils import verify_password
from app.auth.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):

  db_user = db.query(User).filter(User.email == user.email).first()

  if not db_user:
    raise HTTPException(status_code=400, detail="Invalid Credentials")
  
  if not verify_password(user.password, db_user.password):
    raise HTTPException(status_code=400, detail="Invalid Credentials")
  
  token = create_access_token(
    data={"user_id": db_user.user_id, "email": db_user.email}
  )

  return{
    "access_token": token,
    "email": db_user.email,
    "token_type": "Bearer"
  }