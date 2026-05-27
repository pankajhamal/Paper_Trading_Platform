from fastapi import FastAPI

from app.routes.test import router as test_router

from app.database.base import Base
from app.database.connection import engine
import models

Base.metadata.create_all(bind=engine) 

app = FastAPI()

app.include_router(test_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}