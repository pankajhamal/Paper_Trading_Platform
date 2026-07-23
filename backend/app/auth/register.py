from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.schemas.UserRegister import UserRegister
from app.auth.utils import hash_password
from app.database.connection import get_db
from app.models.users import User
from app.models.wallet import Wallet
from app.models.bank_account import BankAccount

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register")
def register_user(user: UserRegister, db: Session = Depends(get_db)):

  # #Check if use already exists
  existing_user = db.query(User).filter(User.email == user.email).first()
  if existing_user:
    raise HTTPException(status_code=400, detail="Email already registered")
  
  hashed_password = hash_password(user.password)

  try:
    new_user = User(
      full_name = user.full_name,
      email = user.email,
      password = hashed_password,
      role="user"
    )

    db.add(new_user)
    db.flush() #Flush sends SQL statements to the db, generating 'user_id'

    #Auto create wallet linked to user
    wallet = Wallet(
      user_id = new_user.user_id,
      balance=100000
    )

    db.add(wallet)

    #Auto create e-bank account (the funding source) linked to user
    bank = BankAccount(
      user_id = new_user.user_id,
      balance = 100000,
      bank_name = "PaperTrade Bank"
    )

    db.add(bank)

    #Commit User + Wallet + BankAccount
    db.commit()
    db.refresh(new_user)
  
  except  SQLAlchemyError as e:
    db.rollback() #Revert all changes in this block if any step fails
    raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail=str(e)
    )

  return{
    "message": "User registered successfully",
    "user_id": new_user.user_id,
    "user_name": new_user.full_name
  }
