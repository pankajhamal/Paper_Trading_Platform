# app/auth/dependencies.py
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.users import User
from app.database.config import settings

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
        
        user_identifier: str = payload.get("email") 
        if user_identifier is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == user_identifier).first()

    if user is None:
        raise credentials_exception

    # A disabled (soft-deleted) account cannot use the API.
    if getattr(user, "is_active", True) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled.",
        )

    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that allows only admin accounts through. Layers on top of
    get_current_user, so the token is validated and the account active first.
    """
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user