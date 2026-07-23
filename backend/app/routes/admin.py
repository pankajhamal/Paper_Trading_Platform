# app/routes/admin.py
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.users import User
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from app.models.withdrawal import WithdrawalRequest
from app.models.fund_request import FundRequest
from app.models.bank_account import BankAccount
from app.auth.dependencies import get_current_admin

logger = logging.getLogger(__name__)

# Every route here requires an admin account (enforced by get_current_admin).
router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(get_current_admin)],
)


class ReviewNote(BaseModel):
    """Optional note an admin can attach when approving/rejecting a request."""
    note: Optional[str] = None


# 1. Platform overview stats (GET /admin/overview)
@router.get("/overview")
async def admin_overview(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.user_id)).scalar() or 0
    active_users = db.query(func.count(User.user_id)).filter(User.is_active.is_(True)).scalar() or 0
    total_balance = db.query(func.coalesce(func.sum(Wallet.balance), 0)).scalar() or 0
    pending_count = db.query(func.count(WithdrawalRequest.id)).filter(
        WithdrawalRequest.status == "PENDING"
    ).scalar() or 0
    pending_amount = db.query(func.coalesce(func.sum(WithdrawalRequest.amount), 0)).filter(
        WithdrawalRequest.status == "PENDING"
    ).scalar() or 0
    pending_fund_count = db.query(func.count(FundRequest.id)).filter(
        FundRequest.status == "PENDING"
    ).scalar() or 0
    pending_fund_amount = db.query(func.coalesce(func.sum(FundRequest.amount), 0)).filter(
        FundRequest.status == "PENDING"
    ).scalar() or 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "disabled_users": total_users - active_users,
        "total_wallet_balance": float(total_balance),
        "pending_withdrawals": pending_count,
        "pending_withdrawals_amount": float(pending_amount),
        "pending_fund_requests": pending_fund_count,
        "pending_fund_requests_amount": float(pending_fund_amount),
    }


# 2. List all users with their wallet balance (GET /admin/users)
@router.get("/users")
async def list_users(db: Session = Depends(get_db)):
    rows = (
        db.query(User, Wallet.balance)
        .outerjoin(Wallet, Wallet.user_id == User.user_id)
        .order_by(User.user_id.asc())
        .all()
    )
    return [
        {
            "user_id": user.user_id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": bool(user.is_active),
            "balance": float(balance) if balance is not None else 0.0,
        }
        for user, balance in rows
    ]


# 3. Soft-delete (disable) a user (DELETE /admin/users/{user_id})
@router.delete("/users/{user_id}")
async def disable_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if (user.role or "").lower() == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts cannot be disabled.")
    if user.is_active is False:
        raise HTTPException(status_code=400, detail="User is already disabled.")

    user.is_active = False
    db.commit()
    return {"user_id": user_id, "is_active": False, "message": "User disabled."}


# 4. Re-enable a disabled user (POST /admin/users/{user_id}/activate)
@router.post("/users/{user_id}/activate")
async def activate_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = True
    db.commit()
    return {"user_id": user_id, "is_active": True, "message": "User re-enabled."}


# 5. List withdrawal requests, optionally filtered by status (GET /admin/withdrawals)
@router.get("/withdrawals")
async def list_withdrawals(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(WithdrawalRequest, User).join(
        User, User.user_id == WithdrawalRequest.user_id
    )
    if status_filter:
        query = query.filter(WithdrawalRequest.status == status_filter.upper())

    rows = query.order_by(WithdrawalRequest.created_at.desc()).all()
    return [
        {
            "request_id": r.id,
            "user_id": r.user_id,
            "user_name": u.full_name,
            "user_email": u.email,
            "amount": float(r.amount),
            "status": r.status,
            "note": r.note,
            "created_at": r.created_at,
            "reviewed_at": r.reviewed_at,
            "reviewed_by": r.reviewed_by,
        }
        for r, u in rows
    ]


def _load_pending_request(request_id: int, db: Session) -> WithdrawalRequest:
    req = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.id == request_id
    ).with_for_update().first()
    if not req:
        raise HTTPException(status_code=404, detail="Withdrawal request not found.")
    if req.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Request already {req.status.lower()}.",
        )
    return req


# 6. Approve a withdrawal (POST /admin/withdrawals/{id}/approve)
#    Debits the user's wallet and credits their e-bank, atomically.
@router.post("/withdrawals/{request_id}/approve")
async def approve_withdrawal(
    request_id: int,
    payload: ReviewNote = ReviewNote(),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    req = _load_pending_request(request_id, db)

    # Lock the wallet (debit) and the bank (credit) in a consistent order.
    wallet = db.query(Wallet).filter(
        Wallet.user_id == req.user_id
    ).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=404, detail="User wallet not found.")

    bank = db.query(BankAccount).filter(
        BankAccount.user_id == req.user_id
    ).with_for_update().first()
    if bank is None:
        bank = BankAccount(user_id=req.user_id, balance=100000, bank_name="PaperTrade Bank")
        db.add(bank)
        db.flush()

    amount = Decimal(str(req.amount))
    wallet_balance = Decimal(str(wallet.balance))
    if amount > wallet_balance:
        raise HTTPException(
            status_code=400,
            detail=(
                f"User's wallet balance (Rs. {wallet_balance:,.2f}) is now less than the "
                f"requested Rs. {amount:,.2f}. Cannot approve — reject it instead."
            ),
        )

    wallet.balance = float(wallet_balance - amount)
    bank.balance = float(Decimal(str(bank.balance)) + amount)

    db.add(Transaction(
        user_id=req.user_id,
        type="WITHDRAW",
        amount=amount,
        description=f"Withdrawal #{req.id} approved — Rs. {amount:,.2f} moved to {bank.bank_name}",
        created_at=datetime.utcnow()
    ))

    req.status = "APPROVED"
    req.note = payload.note
    req.reviewed_by = admin.user_id
    req.reviewed_at = datetime.utcnow()
    db.commit()
    return {"request_id": request_id, "status": "APPROVED", "debited": float(amount)}


# 7. Reject a withdrawal (POST /admin/withdrawals/{id}/reject) — no balance change.
@router.post("/withdrawals/{request_id}/reject")
async def reject_withdrawal(
    request_id: int,
    payload: ReviewNote = ReviewNote(),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    req = _load_pending_request(request_id, db)
    req.status = "REJECTED"
    req.note = payload.note
    req.reviewed_by = admin.user_id
    req.reviewed_at = datetime.utcnow()
    db.commit()
    return {"request_id": request_id, "status": "REJECTED"}


# 8. List fund (money) requests, optionally filtered by status (GET /admin/fund-requests)
@router.get("/fund-requests")
async def list_fund_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(FundRequest, User).join(
        User, User.user_id == FundRequest.user_id
    )
    if status_filter:
        query = query.filter(FundRequest.status == status_filter.upper())

    rows = query.order_by(FundRequest.created_at.desc()).all()
    return [
        {
            "request_id": r.id,
            "user_id": r.user_id,
            "user_name": u.full_name,
            "user_email": u.email,
            "amount": float(r.amount),
            "status": r.status,
            "note": r.note,
            "created_at": r.created_at,
            "reviewed_at": r.reviewed_at,
            "reviewed_by": r.reviewed_by,
        }
        for r, u in rows
    ]


def _load_pending_fund_request(request_id: int, db: Session) -> FundRequest:
    req = db.query(FundRequest).filter(
        FundRequest.id == request_id
    ).with_for_update().first()
    if not req:
        raise HTTPException(status_code=404, detail="Fund request not found.")
    if req.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Request already {req.status.lower()}.",
        )
    return req


# 9. Approve a fund request (POST /admin/fund-requests/{id}/approve) — credits the e-bank.
@router.post("/fund-requests/{request_id}/approve")
async def approve_fund_request(
    request_id: int,
    payload: ReviewNote = ReviewNote(),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    req = _load_pending_fund_request(request_id, db)

    # Credit the requesting user's e-bank (create the row if it doesn't exist yet).
    bank = db.query(BankAccount).filter(
        BankAccount.user_id == req.user_id
    ).with_for_update().first()
    if bank is None:
        bank = BankAccount(user_id=req.user_id, balance=100000, bank_name="PaperTrade Bank")
        db.add(bank)
        db.flush()

    amount = Decimal(str(req.amount))
    bank.balance = float(Decimal(str(bank.balance)) + amount)

    db.add(Transaction(
        user_id=req.user_id,
        type="FUND_APPROVED",
        amount=amount,
        description=f"Fund request #{req.id} approved — Rs. {amount:,.2f} credited to e-bank",
        created_at=datetime.utcnow()
    ))

    req.status = "APPROVED"
    req.note = payload.note
    req.reviewed_by = admin.user_id
    req.reviewed_at = datetime.utcnow()
    db.commit()
    return {"request_id": request_id, "status": "APPROVED", "credited": float(amount)}


# 10. Reject a fund request (POST /admin/fund-requests/{id}/reject) — no balance change.
@router.post("/fund-requests/{request_id}/reject")
async def reject_fund_request(
    request_id: int,
    payload: ReviewNote = ReviewNote(),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    req = _load_pending_fund_request(request_id, db)
    req.status = "REJECTED"
    req.note = payload.note
    req.reviewed_by = admin.user_id
    req.reviewed_at = datetime.utcnow()
    db.commit()
    return {"request_id": request_id, "status": "REJECTED"}
