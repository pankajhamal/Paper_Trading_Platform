from fastapi import FastAPI
from app.database.base import Base
from app.database.connection import engine
from app.service.schedular import update_all_stock_prices, restore_market_cache
from app.service.expiration import cancel_expired_daily_orders
from app.service.matcher import match_pending_orders
from app.service.alert_checker import check_price_alerts
from app.service.seed import seed_default_admin
from app.models import User, Wallet, Transaction, Stock, Portfolio, Order, WithdrawalRequest, BankAccount, FundRequest, PasswordResetOTP
import asyncio
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


#Import Routes
from app.auth.register import router as register_router
from app.auth.login import router as login_router
from app.auth.password_reset import router as password_reset_router
from app.routes.trade import router as trade_router
from app.routes.user import router as user_router
from app.routes.stock import router as stock_router
from app.routes.watchlist import router as watchlist_router
from app.routes.alerts import router as alerts_router
from app.routes.market import router as market_router
from app.routes.admin import router as admin_router
from app.routes.public import router as public_router

Base.metadata.create_all(bind=engine) 

app = FastAPI(
    title="Paper Trading Platform",
    version="1.0.0"
)

origins = [
    "http://localhost:5173",  # Default Vite port
    "http://localhost:3000",  # Alternative React port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],      # Allows GET, POST, OPTIONS, PUT, DELETE
    allow_headers=["*"],      # Allows headers like Content-Type, Authorization
)

# Serve uploaded files (e.g. profile photos) as static assets at /uploads
os.makedirs("uploads/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
async def startup_event():
    # Ensure the default admin account exists (from .env), before anything else.
    seed_default_admin()

    # Warm the depth cache from the last saved snapshot so orders placed before
    # the first successful bridge fetch still match against real order books.
    restore_market_cache()

    #Start the periodic updater as a background task
    asyncio.create_task(update_all_stock_prices())

    asyncio.create_task(cancel_expired_daily_orders())

    # Fills resting limit orders when the market reaches their price
    asyncio.create_task(match_pending_orders())

    # Trips price alerts when the market crosses their target
    asyncio.create_task(check_price_alerts())

    print("[SERVER] All background services started successfully.")



@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(register_router)
app.include_router(login_router)
app.include_router(password_reset_router)
app.include_router(trade_router)
app.include_router(user_router)
app.include_router(stock_router)
app.include_router(watchlist_router)
app.include_router(alerts_router)
app.include_router(market_router)
app.include_router(admin_router)
app.include_router(public_router)
