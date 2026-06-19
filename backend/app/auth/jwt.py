from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.database.config import settings

def create_access_token(data: dict):
  to_encode = data.copy()

  expire=datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MINUTES)
  to_encode.update({"exp": expire})

  return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM,)