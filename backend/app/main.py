from fastapi import FastAPI
from app.database.base import Base
from app.database.connection import engine
from app.service.schedular import update_all_stock_prices
from app.models import User, Wallet, Transaction, Stock, Portfolio
import asyncio

#Import Routes
from app.auth.register import router as register_router
from app.auth.login import router as login_router
from app.routes.trade import router as trade_router
from app.routes.user import router as user_router

Base.metadata.create_all(bind=engine) 

app = FastAPI(
    title="Paper Trading Platform",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    #Start the periodic updater as a background task
    asyncio.create_task(update_all_stock_prices())

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(register_router)
app.include_router(login_router)
app.include_router(trade_router)
app.include_router(user_router)