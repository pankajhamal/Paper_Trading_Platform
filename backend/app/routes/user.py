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
from app.schemas.wallet import WalletDeposit, WalletWithdraw, BankLoad, FundRequestCreate
from app.models.withdrawal import WithdrawalRequest
from app.models.bank_account import BankAccount
from app.models.fund_request import FundRequest
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


# --- E-Bank: the simulated funding source the user loads into their wallet ---

def get_or_create_bank(user_id: int, db: Session, lock: bool = False) -> BankAccount:
    """
    Return the user's e-bank account, creating a default one (Rs 100,000) if it
    doesn't exist yet. This lets pre-existing users (created before the e-bank
    feature) work without depending on the backfill migration. Pass lock=True to
    select the row FOR UPDATE when a balance mutation follows.
    """
    query = db.query(BankAccount).filter(BankAccount.user_id == user_id)
    if lock:
        query = query.with_for_update()
    bank = query.first()
    if bank is None:
        bank = BankAccount(user_id=user_id, balance=100000, bank_name="PaperTrade Bank")
        db.add(bank)
        db.commit()
        # Re-select (with the lock if requested) now that the row exists.
        query = db.query(BankAccount).filter(BankAccount.user_id == user_id)
        if lock:
            query = query.with_for_update()
        bank = query.first()
    return bank


# 2b. Get the current user's e-bank balance (GET /users/me/bank)
@router.get("/me/bank")
async def get_bank(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bank = get_or_create_bank(current_user.user_id, db)
    return {
        "balance": float(bank.balance),
        "bank_name": bank.bank_name,
        "currency": "NPR"
    }


# 2c. Load funds from the e-bank into the wallet (POST /users/me/bank/load).
#     Gated by the e-bank balance — this is the only way to fund the wallet now.
@router.post("/me/bank/load")
async def load_from_bank(
    payload: BankLoad,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Debits the e-bank and credits the trading wallet by the same amount, atomically.
    Rejects the load if the e-bank balance is insufficient.
    """
    # Lock the bank row first, then the wallet row (consistent order avoids deadlock).
    bank = get_or_create_bank(current_user.user_id, db, lock=True)
    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.user_id
    ).with_for_update().first()
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found."
        )

    amount = Decimal(str(payload.amount)).quantize(Decimal("0.01"))
    bank_balance = Decimal(str(bank.balance))
    if amount > bank_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient bank balance (Rs. {bank_balance:,.2f}). Request more funds to top up your e-bank."
        )

    if payload.bank_name:
        bank.bank_name = payload.bank_name

    bank.balance = float(bank_balance - amount)
    wallet.balance = float(Decimal(str(wallet.balance)) + amount)

    db.add(Transaction(
        user_id=current_user.user_id,
        type="DEPOSIT",
        amount=amount,
        description=f"Loaded Rs. {amount:,.2f} from {bank.bank_name} into wallet",
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(bank)
    db.refresh(wallet)

    return {
        "wallet_balance": float(wallet.balance),
        "bank_balance": float(bank.balance),
        "bank_name": bank.bank_name,
        "currency": "NPR",
        "amount": float(amount)
    }


# 2d. Request more paper money (POST /users/me/bank/request).
#     Nothing is held — an admin later approves (credits the e-bank) or rejects.
@router.post("/me/bank/request")
async def request_funds(
    payload: FundRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a PENDING fund request. On approval the e-bank balance is credited."""
    amount = Decimal(str(payload.amount)).quantize(Decimal("0.01"))

    fund_request = FundRequest(
        user_id=current_user.user_id,
        amount=amount,
        status="PENDING",
        note=payload.note,
        created_at=datetime.utcnow()
    )
    db.add(fund_request)

    db.add(Transaction(
        user_id=current_user.user_id,
        type="FUND_REQUEST",
        amount=amount,
        description=f"Requested Rs. {amount:,.2f} — pending approval",
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(fund_request)

    return {
        "request_id": fund_request.id,
        "amount": float(amount),
        "status": fund_request.status,
    }


# 2e. List the current user's own fund requests (GET /users/me/bank/requests).
@router.get("/me/bank/requests")
async def get_my_fund_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the logged-in user's fund requests, most recent first."""
    requests = db.query(FundRequest).filter(
        FundRequest.user_id == current_user.user_id
    ).order_by(FundRequest.created_at.desc()).all()
    return [
        {
            "request_id": r.id,
            "amount": float(r.amount),
            "status": r.status,
            "note": r.note,
            "created_at": r.created_at,
            "reviewed_at": r.reviewed_at,
        }
        for r in requests
    ]


# 2c. Request a withdrawal (POST /users/me/wallet/withdraw).
#     Funds are HELD immediately; an admin later approves or rejects the request.
@router.post("/me/wallet/withdraw")
async def request_withdrawal(
    payload: WalletWithdraw,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a PENDING withdrawal request (wallet -> bank). Nothing is deducted
    now — an admin approves it (wallet debited, e-bank credited) or rejects it
    (no change). The wallet balance is re-checked at approval time.
    """
    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.user_id
    ).first()
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found."
        )

    amount = Decimal(str(payload.amount)).quantize(Decimal("0.01"))
    balance = Decimal(str(wallet.balance))
    if amount > balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient wallet balance. Available: Rs. {balance:,.2f}"
        )

    withdrawal = WithdrawalRequest(
        user_id=current_user.user_id,
        amount=amount,
        status="PENDING",
        created_at=datetime.utcnow()
    )
    db.add(withdrawal)

    db.commit()
    db.refresh(withdrawal)

    return {
        "request_id": withdrawal.id,
        "amount": float(amount),
        "status": withdrawal.status,
    }


# 2d. List the current user's own withdrawal requests (GET /users/me/withdrawals).
@router.get("/me/withdrawals")
async def get_my_withdrawals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the logged-in user's withdrawal requests, most recent first."""
    requests = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.user_id == current_user.user_id
    ).order_by(WithdrawalRequest.created_at.desc()).all()

    return [
        {
            "request_id": r.id,
            "amount": float(r.amount),
            "status": r.status,
            "note": r.note,
            "created_at": r.created_at,
            "reviewed_at": r.reviewed_at,
        }
        for r in requests
    ]


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