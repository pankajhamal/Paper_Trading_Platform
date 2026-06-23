# app/auth/dependencies.py
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.users import User
from app.database.config import settings

# IMPORTANT: These must match the SECRET_KEY and ALGORITHM you used 
# when generating the JWT token during your login route.
# SECRET_KEY = "YOUR_SECRET_KEY_HERE"  # Ideally loaded from .env/config
# ALGORITHM = "HS256"

# Points to your login endpoint so Swagger UI knows where to send credentials to get a token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login") 

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session has expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 1. Decode the JWT token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # 'sub' (Subject) usually holds the user's email or user_id 
        # depending on how you encoded your JWT during login
        user_identifier: str = payload.get("email") 
        if user_identifier is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception

    # 2. Fetch the user from the database
    # Adjust this query if you stored 'user_id' instead of 'email' in the JWT payload
    user = db.query(User).filter(User.email == user_identifier).first()
    
    if user is None:
        raise credentials_exception
        
    return user