# app/api/user.py
import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.models.wallet import Wallet
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction
from app.models.stock import Stock
from app.auth.dependencies import get_current_user
from app.auth.utils import hash_password, verify_password
from app.schemas.UserProfile import ProfileUpdate, PasswordChange
from app.controller.orders import get_user_orders  # New import


logger = logging.getLogger(__name__)

# Where uploaded avatar images are stored on disk (served at /uploads by main.py)
AVATAR_DIR = "uploads/avatars"
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB

# Prefixing the routes with "/users"
router = APIRouter(prefix="/users", tags=["User Profile & Assets"])


def _profile_payload(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }


# 1. Fetch User Profile Details (GET /users/me)
@router.get("/me")
def get_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the profile details of the currently logged-in user.
    """
    return _profile_payload(current_user)


# 1b. Update editable profile fields (PATCH /users/me)
@router.patch("/me")
def update_user_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates the logged-in user's editable profile fields (currently full name).
    """
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.full_name is not None:
        name = payload.full_name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name cannot be empty.",
            )
        user.full_name = name

    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update profile for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile.",
        )

    return {"message": "Profile updated.", "profile": _profile_payload(user)}


# 1c. Change password (PUT /users/me/password)
@router.put("/me/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Changes the logged-in user's password after verifying the current one.
    """
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not verify_password(payload.current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if verify_password(payload.new_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    try:
        user.password = hash_password(payload.new_password)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to change password for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password.",
        )

    return {"message": "Password changed successfully."}


# 1d. Upload / replace profile photo (POST /users/me/avatar)
@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Uploads a profile photo, stores it on disk, and saves its URL on the user.
    """
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Use JPG, PNG, WEBP or GIF.",
        )

    contents = await file.read()
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is too large. Maximum size is 5 MB.",
        )

    os.makedirs(AVATAR_DIR, exist_ok=True)
    filename = f"user_{current_user.user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(AVATAR_DIR, filename)

    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Remember the old file so we can clean it up after a successful swap
    old_url = user.avatar_url

    try:
        with open(file_path, "wb") as f:
            f.write(contents)
        user.avatar_url = f"/{file_path}"
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save avatar for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save profile photo.",
        )

    # Best-effort delete of the previous avatar file
    if old_url:
        old_path = old_url.lstrip("/")
        if old_path != file_path and os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    return {"message": "Profile photo updated.", "avatar_url": user.avatar_url}


# 2. Fetch User's Wallet (GET /users/me/wallet)
@router.get("/me/wallet")
async def get_user_wallet(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the logged-in user's wallet balance.
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Wallet not found."
        )
    return {
        "balance": wallet.balance,
        "currency": "NPR"
    }


# 3. Fetch User's Transaction History (GET /users/me/transactions)
@router.get("/me/transactions")
async def get_user_transactions(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the past trade transaction ledger for the logged-in user (most recent first).
    """
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.user_id
    ).order_by(Transaction.created_at.desc()).all()
    
    return [
        {
            "transaction_id": tx.transaction_id,
            "type": tx.type,
            "amount": float(tx.amount) if tx.amount else 0.0,
            "description": tx.description,
            "created_at": tx.created_at
        }
        for tx in transactions
    ]


# 4. Fetch User's Portfolio Details (GET /users/me/portfolio)
@router.get("/me/portfolio")
async def get_user_portfolio(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Calculates and returns the user's current stock holdings and total portfolio valuation.
    """
    portfolio_entries = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.user_id
    ).all()
    
    holdings = []
    total_invested_value = 0.0
    total_current_value = 0.0

    for entry in portfolio_entries:
        stock = entry.stock
        if not stock:
            stock = db.query(Stock).filter(Stock.stock_id == entry.stock_id).first()
            
        if not stock:
            continue

        qty = entry.quantity
        avg_price = float(entry.average_price)
        current_price = float(stock.last_traded_price)

        invested = qty * avg_price
        current_val = qty * current_price
        profit_loss = current_val - invested
        profit_loss_percentage = (profit_loss / invested * 100) if invested > 0 else 0.0

        total_invested_value += invested
        total_current_value += current_val

        holdings.append({
            "symbol": stock.symbol,
            "company_name": stock.company_name,
            "quantity": qty,
            "average_price": round(avg_price, 2),
            "current_price": round(current_price, 2),
            "invested_value": round(invested, 2),
            "current_value": round(current_val, 2),
            "profit_loss": round(profit_loss, 2),
            "profit_loss_percentage": round(profit_loss_percentage, 2)
        })

    total_profit_loss = total_current_value - total_invested_value
    total_profit_loss_percentage = (total_profit_loss / total_invested_value * 100) if total_invested_value > 0 else 0.0

    return {
        "summary": {
            "total_invested_value": round(total_invested_value, 2),
            "total_current_value": round(total_current_value, 2),
            "total_profit_loss": round(total_profit_loss, 2),
            "total_profit_loss_percentage": round(total_profit_loss_percentage, 2)
        },
        "holdings": holdings
    }

@router.get("/orders", status_code=status.HTTP_200_OK)
async def get_orders(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    HTTP GET Route for retrieving complete order history.
    """
    return await get_user_orders(db=db, current_user=current_user)