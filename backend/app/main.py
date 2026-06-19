from fastapi import FastAPI
from app.database.base import Base
from app.database.connection import engine

from app.models import User, Wallet, Transaction

Base.metadata.create_all(bind=engine) 

app = FastAPI(
    title="Paper Trading Platform",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {"status": "healthy"}