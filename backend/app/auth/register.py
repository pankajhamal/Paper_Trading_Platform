from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.schemas.UserRegister import UserRegister
from app.auth.utill import hash_password
from app.database.connection import get_db
from app.models.users import User
from app.models.wallet import Wallet

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register")
def register_user(user: UserRegister, db: Session = Depends(get_db)):

  #Check if use already exists
  existing_user = db.query(User).filter(user.email == user.email).first()
  if existing_user:
    raise HTTPException(status_code=400, detail="Email already registered")
  
  #hash password
  print(user.password)
  print(type(user.password))
  print(len(user.password))
  hashed_password = hash_password(user.password)

  #Create User
  new_user = User(
    full_name = user.full_name,
    email= user.email,
    password = hashed_password,
    balance = 100000,
    role="user"
  )

  db.add(new_user)
  db.commit()
  db.refresh(new_user)

  #Auto create wallet whenever User is created
  wallet = Wallet(
    user_id = new_user.id,
    balance = 100000
  )

  db.add(wallet)
  db.commit()

  return{
    "message": "User registered successfully",
    "user_id": new_user.id,
    "user_name": new_user.full_name
  }