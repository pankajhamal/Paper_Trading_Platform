from fastapi import FastAPI
from app.database.base import Base
from app.database.connection import engine

from app.models import User, Wallet, Transaction

#Import Routes
from app.auth.register import router as auth_router
from app.auth.login import router as login_router

Base.metadata.create_all(bind=engine) 

app = FastAPI(
    title="Paper Trading Platform",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(auth_router)
app.include_router(login_router)