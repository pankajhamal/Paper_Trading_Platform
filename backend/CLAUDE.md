# CLAUDE.md — backend

Service-specific guidance for the FastAPI backend. See the repo-root `CLAUDE.md` for the big-picture, cross-service view (three services, data flow, run order). This file covers backend internals that require reading several files to understand.

## Stack & entrypoint

FastAPI + SQLAlchemy 2.0 + PostgreSQL (psycopg2), Pydantic v2 / pydantic-settings, python-jose (JWT), passlib+bcrypt, httpx (client to the Bun bridge). App package is `app/`, entrypoint `app/main.py`. Run from this directory: `uvicorn app.main:app --reload` (docs at `/docs`).

## Request layering

Routes are **thin and hold no business logic**: `routes/*.py` (async, inject dependencies) → delegate to `controller/*.py` (all business logic) → which read `service/*` (background loops, the market cache, the bridge client). Example: `POST /trade/buy` (`routes/trade.py`) → `await execute_buy(payload, db, current_user)` (`controller/buy.py`).

- **DB session**: `get_db` from `database/connection.py` — a generator that yields `SessionLocal()` and closes in `finally`. It does **not** commit or roll back; **controllers own transaction boundaries** (`db.commit()` / rollback-on-exception). Don't add commits to routes.
- **Schema creation**: `main.py` calls `Base.metadata.create_all()` at import — this only creates *missing tables*, never ALTERs. Schema *changes* go through Alembic (`alembic/versions/`); see root CLAUDE.md.

## Auth (`app/auth/`)

- Login (`login.py`, `POST /auth/login`, router prefix `/auth`) uses `OAuth2PasswordRequestForm` — the `username` form field **is the email**. Returns `{access_token, email, full_name, avatar_url, role, token_type}`.
- Token is created in `jwt.py` `create_access_token(data)` carrying **`user_id`, `email`, `exp`**. No refresh token.
- **`get_current_user` (`dependencies.py`) is the dependency all protected routes inject.** It decodes the JWT and looks the user up by the **`email` claim** (not `user_id`) — keep that in mind if you change token contents. Returns 401 on bad/missing token, 403 if `is_active is False` (soft-deleted).
- **Admin gating**: `get_current_admin` wraps `get_current_user` and 403s unless `role.lower() == "admin"`. `routes/admin.py` applies it router-wide via `dependencies=[Depends(get_current_admin)]`. `role` is a plain string column (`"user"`/`"admin"`), no enum.
- Register auto-creates a `Wallet` with `balance=100000` in the same transaction. Default admin is seeded on startup by `service/seed.py` `seed_default_admin()` (idempotent, from `.env`).

## Order-matching engine (`controller/buy.py`, `sell.py`) — the highest-risk code

**Escrow has no dedicated column.** It is implemented by directly mutating real balances, with the held amount living *implicitly* in the resting order:

- **BUY escrow = cash**: `Wallet.balance` is debited immediately by `executed_cost + (remaining_qty × limit_price)`. The still-held portion is only recoverable as `Order.remaining_quantity × Order.limit_price`.
- **SELL escrow = shares**: `Portfolio.quantity` is decremented by the *full* order quantity at placement (the portfolio row is deleted if it hits 0).
- A `Transaction` row logs each hold (`ESCROW_HOLD` / `ASSET_ESCROW_HOLD`) and release (`ESCROW_RELEASE` / `ASSET_ESCROW_RELEASE`) for audit only — balances are not derived from them.

⚠️ **Any reversal (cancel, expiry, matcher refund) must recompute escrow the same way** — `remaining_quantity × limit_price` for cash, `remaining_quantity` for shares. Diverge and balances drift. This logic lives in `controller/cancel.py`, `service/expiration.py`, and `service/matcher.py`.

Other invariants in `buy.py`/`sell.py`:
- **Circuit filter (±10%)** and **tick size (Rs 0.10)** are enforced **only for LIMIT orders**, and are **duplicated verbatim** in both files (not shared) — edit both. Filter: reject if `limit_price` outside `last_traded_price × [0.90, 1.10]`. Tick: reject if `(limit_price × 10) % 1 != 0`.
- **Depth walk**: buy walks ask levels (`sellMarketDepthList`), sell walks bid levels (`buyMarketDepthList`), taking `min(remaining, level_qty)` per level. Books are consumed in source order — the engine does not re-sort. LIMIT orders stop walking once the level price crosses the limit.
- **Status**: `final_status = "COMPLETED" if remaining == 0 else "PENDING"`. **MARKET orders with leftover quantity raise 400** (never rest), so only LIMIT orders become PENDING.
- Order transaction opens with `wallet` locked via `with_for_update()`, checks balance, then commits (rollback on any exception).

## Background services (`service/`)

All four are launched in `main.py` `@app.on_event("startup")` via `asyncio.create_task`. Each opens its own short-lived session per cycle (`next(get_db())`) and sleeps between cycles.

- **`schedular.py` `update_all_stock_prices`** — every **300s (hardcoded)**. Pulls the whole market from the bridge (`NepseService.get_live_market`), then `LIVE_MARKET_DEPTH.clear()` + repopulate, and upserts every `Stock`.
- **`matcher.py` `match_pending_orders`** — every `MATCHER_INTERVAL_SECONDS` (default 10s). Fills resting LIMIT orders; re-locks each with `with_for_update(skip_locked=True)` and **re-validates status under the lock** before releasing/refunding escrow — this guards the double-release race with a concurrent cancel. Don't remove the re-check.
- **`expiration.py` `cancel_expired_daily_orders`** — every `EXPIRY_SCAN_INTERVAL_SECONDS` (default 30s). Expires orders older than `ORDER_EXPIRY_MINUTES × 60` (default 360 min) → status `EXPIRED`, refunds escrow.
- **`alert_checker.py` `check_price_alerts`** — every `ALERT_CHECK_INTERVAL_SECONDS = 60` (module constant, not in settings). Trips ACTIVE alerts (ABOVE: price≥target, BELOW: price≤target) → `TRIGGERED`.

**`LIVE_MARKET_DEPTH`** (`service/cache.py`): a module-global `Dict[str, Any]` keyed by **uppercase symbol → full stock item dict** from the bridge. Consumers read `cached["marketDepth"]["sellMarketDepthList" | "buyMarketDepthList"]`. When a symbol is absent, `buy`/`sell` fall back to `generate_simulated_depth` / `generate_simulated_bid_depth` in `service/nepse.py` (5 synthetic levels at ±1..±5 from base price).

`service/nepse.py` `NepseService` (bridge at `http://localhost:3000`) exposes `get_live_market`, `get_nepse_index`, `get_market_summary`, `get_market_depth` (normalizes bridge key `orderBookOrderPrice` → `price`).

## Models (`app/models/`, registered in `models/__init__.py`)

Statuses and types are **plain strings, no Python enums**:
- **`Order`**: `order_type` "MARKET"/"LIMIT"; `transaction_type` "BUY"/"SELL"; `status` one of **PENDING / COMPLETED / CANCELLED / EXPIRED**; `remaining_quantity` (partial fills); `limit_price` Numeric(12,2), null for market.
- **`Wallet`**: `balance` **Numeric(12,2)**, default 100000. **No escrow/locked column** (see engine notes).
- **`Portfolio`**: unique per `(user_id, stock_id)` (`uq_user_stock`); `average_price` is weighted-avg cost updated on buys.
- **`Transaction`**: `type` string (BUY, SELL, ESCROW_HOLD/RELEASE, ASSET_ESCROW_HOLD/RELEASE, plus wallet deposit/withdraw) — audit log.
- **`WithdrawalRequest`**: `status` PENDING/APPROVED/REJECTED; `reviewed_by` FK; two relationships (`user`, `reviewer`) with explicit `foreign_keys`.
- **`User`**: `role` string; `is_active` bool (soft-delete); `wallet`/`portfolio`/`orders` relationships (portfolio & orders cascade delete-orphan).
- **`Stock`**: `symbol` unique-indexed; price/OHLC/volume floats; `last_traded_price` drives circuit limits.
- **`Alert`**: `condition` ABOVE/BELOW, `status` ACTIVE→TRIGGERED. **`Watchlist`**: unique per `(user_id, stock_id)`.

## Schemas & conventions (`app/schemas/`)

- **Mixed file casing** (existing convention, don't "fix" blindly): PascalCase `UserLogin.py`, `UserRegister.py`, `UserProfile.py`; lowercase `trade.py`, `wallet.py`. All Pydantic v2.
- `trade.py`: `StockBuy`/`StockSell` (`symbol`, `quantity: int gt=0`, `order_type` default "MARKET", `limit_price: Decimal gt=0` optional).
- Login uses `OAuth2PasswordRequestForm`, **not** the `UserLogin` schema.
- **Money precision gap**: columns are `Numeric`, but `buy/sell/cancel/matcher/expiration` repeatedly assign `float(...)` back into `wallet.balance` — a known precision-mixing pattern. Prefer `Decimal` in new money math.
- **Logger**: `core/logger.py` `get_logger()` (stdout, INFO). Most services just use `logging.getLogger(__name__)`; only `nepse.py` uses `get_logger`.
- **Dead/unwired**: `service/stock_manager.py` is fully commented out; `routes/test.py` exists but is not included in `main.py`.

## Config (`.env` → `database/config.py`)

`Settings(BaseSettings)` singleton. Required: `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRES_MINUTES`. Tunable (defaults): `ORDER_EXPIRY_MINUTES=360`, `MATCHER_INTERVAL_SECONDS=10`, `EXPIRY_SCAN_INTERVAL_SECONDS=30`, plus `DEFAULT_ADMIN_*`. Drop `ORDER_EXPIRY_MINUTES` to ~2 to demo the expiry flow.
