# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A NEPSE (Nepal Stock Exchange) paper-trading simulator. Users trade Nepali stocks with virtual money (wallet starts at Rs 100,000) against real live market data. It is three independent services that must run together:

- **`backend/`** — FastAPI + SQLAlchemy + PostgreSQL (the core: auth, order matching, escrow, wallet, portfolio). Serves on `:8000`.
- **`frontend/`** — React 19 + Vite + Zustand + Tailwind 4 SPA. Dev server on `:5173`.
- **`nepse-bridge/`** — Bun + TypeScript. Thin HTTP wrapper around the `nepse-api-unofficial` package. Serves on `:3000`.

Data flows one direction: `nepse-bridge` pulls from NEPSE → `backend` consumes the bridge over HTTP → `frontend` calls the backend. The frontend never talks to the bridge directly.

**There are also service-level `CLAUDE.md` files — read the relevant one before working in that service:** `backend/CLAUDE.md` (layering, auth internals, the exact escrow implementation, model/status vocabularies) and `frontend/CLAUDE.md` (axios interceptors, per-store endpoint maps, route guards, UI conventions). This root file is the cross-service view only.

## Running the stack

All three services must be up for live data to work. Start them in separate terminals.

```bash
# 1. nepse-bridge  (port 3000) — start FIRST, backend depends on it
cd nepse-bridge && bun install && bun run index.ts

# 2. backend  (port 8000)
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head                 # apply migrations before first run
uvicorn app.main:app --reload        # docs at http://localhost:8000/docs

# 3. frontend  (port 5173)
cd frontend && npm install
npm run dev        # build: npm run build | lint: npm run lint (oxlint) | preview: npm run preview
```

The backend needs a `backend/.env` (gitignored). Required keys are defined in `backend/app/database/config.py`: `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRES_MINUTES`. That same `Settings` class also exposes:

- **Order-lifecycle tuning:** `ORDER_EXPIRY_MINUTES` (default 360 ≈ a trading day — drop to ~2 to demo expiry), `MATCHER_INTERVAL_SECONDS` (10), `EXPIRY_SCAN_INTERVAL_SECONDS` (30).
- **Seeded default admin:** `DEFAULT_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` — created idempotently on startup by `service/seed.py`.
- **Password-reset OTP + SMTP:** `OTP_LENGTH`/`OTP_EXPIRY_MINUTES`/`OTP_MAX_ATTEMPTS` and `MAIL_*`. Dev points at Mailtrap's sandbox, so OTP mail lands in the Mailtrap inbox, never a real one. `service/email.py` raises if `MAIL_USERNAME`/`MAIL_PASSWORD` are unset.

## Tests

pytest lives in `backend/tests/` (config: `backend/pytest.ini`, `testpaths = tests`). From `backend/` with the venv active:

```bash
python -m pytest                                   # whole suite
python -m pytest tests/test_escrow.py              # one file
python -m pytest tests/test_escrow.py::test_limit_buy_escrows_then_cancel_refunds_exactly   # one test
```

`tests/test_escrow.py` covers the escrow round-trip and the NEPSE price rules; `tests/test_depth.py` covers order-book resolution and the fills that come out of it.

⚠️ **These are integration tests, not unit tests** — they drive the real FastAPI app through `TestClient` against the **`DATABASE_URL` database from `.env`** (there is no separate test DB). Fixtures in `tests/conftest.py` create uniquely-named throwaway users/stocks and delete their rows on teardown; keep that pattern so runs don't collide with or pollute real accounts. `test_stock` also pops the symbol out of `LIVE_MARKET_DEPTH` so matching takes the simulated-depth path (asks at 101..105 for a Rs 100 stock) and tests stay deterministic. The frontend has no test setup — `npm run lint` (oxlint) and `npm run build` are the checks there.

## Database & migrations — read this before touching a model

The app calls `Base.metadata.create_all()` on startup (`backend/app/main.py`), which **only creates missing tables — it never ALTERs existing ones**. Alembic (`backend/alembic/`, config in `backend/alembic.ini`) is the source of truth for schema *changes*.

- Adding a column to an existing table requires a migration; `create_all` will not apply it, and forgetting this has caused hand-run `ALTER TABLE` statements against the live DB.
- Migration commands (from `backend/`): `alembic revision --autogenerate -m "msg"`, then `alembic upgrade head`.

## Backend architecture

FastAPI app is assembled in `app/main.py`: it mounts routers, enables CORS for the Vite origins, serves uploaded avatars as static files at `/uploads`, and on startup seeds the default admin then launches **four asyncio background loops** — internalize these, they drive most of the "things happen on their own" behavior:

- `service/schedular.py` `update_all_stock_prices` — periodically pulls the whole market from the bridge, refreshes the in-RAM price cache, and saves it as a snapshot (see below).
- `service/matcher.py` `match_pending_orders` — fills resting limit orders when the market reaches their price.
- `service/expiration.py` `cancel_expired_daily_orders` — expires day-orders and returns their escrow.
- `service/alert_checker.py` `check_price_alerts` — trips price alerts when the market crosses a target.

Directory roles under `app/`:
- `auth/` — JWT/OAuth2 login/register, bcrypt hashing, token dependencies.
- `routes/` — thin FastAPI routers (HTTP layer). `controller/` — the business logic they call.
- `controller/{buy,sell}.py` — the **order-matching engine** (see below). `controller/cancel.py` — reverses escrow on manual cancel.
- `service/` — background loops, the market cache, and `nepse.py` (`NepseService`, the HTTP client to the bridge + `generate_simulated_depth`/`generate_simulated_bid_depth` fallbacks).
- `models/` — SQLAlchemy models. `schemas/` — Pydantic request/response models.

### Order matching, escrow, and money — the highest-risk code

When editing `controller/buy.py`, `controller/sell.py`, `controller/cancel.py`, or `service/matcher.py`, preserve these domain invariants:

- **Escrow model:** a placed order locks cash (buys) or shares (sells). Cancel and expiry *release* escrow back. The matcher re-validates order status **under a row lock** (`with_for_update(skip_locked=True)`) before releasing — this guards against a double-release race between the matcher and a concurrent manual cancel. Do not remove the re-check-under-lock.
- **Market depth:** never read the order book directly — call `service/depth.py` `resolve_levels(symbol, side, reference_price)`, which returns `(levels, source)` where source is `live` / `snapshot` / `simulated`. See the depth section below for the resolution chain and its guards.
- **Never resolve depth while holding a row lock.** `resolve_levels` can make an HTTP call to the bridge; holding a lock across a network timeout would block a concurrent cancel. `buy.py`/`sell.py` resolve before their transaction block, and the matcher pre-resolves every book it needs at the top of the cycle.
- **NEPSE rules to enforce:** ±10% circuit filter on price, and Rs 0.10 tick size.
- **Known money-precision gap:** wallet balance is `Numeric(12,2)`, but buy/sell/cancel/matcher still `float()`-cast before writing, so float rounding is not fully eliminated. Prefer `Decimal` when adding new money math.

Portfolio rows are unique per `(user_id, stock_id)`. NEPSE market hours (used for the open/closed status) are Sun–Thu, 11:00–15:00 NPT.

### The other money flow: e-bank, fund requests, withdrawals

Trading escrow is not the only place cash moves. Every user also has a **simulated e-bank account** (`models/bank_account.py`, one row per user, starts at Rs 100,000) that sits *beside* the trading wallet, and two admin-approved queues between them:

- **Wallet top-up:** `POST /users/me/bank/load` moves e-bank → wallet directly. When the e-bank runs dry, `POST /users/me/bank/request` files a `FundRequest`, which an admin approves via `POST /admin/fund-requests/{id}/approve|reject` (`GET /admin/fund-requests` to list).
- **Withdrawal:** `POST /users/me/wallet/withdraw` files a `WithdrawalRequest` (PENDING). The wallet is **debited only on admin approval** (`POST /admin/withdrawals/{id}/approve|reject`) — don't move the debit to request time.
- Both `Wallet.balance` and `BankAccount.balance` carry DB-level `CHECK (>= 0)` constraints (see the `add_nonneg_check_constraints` migration), so a logic bug surfaces as an `IntegrityError` rather than a negative balance.

Frontend side: `EBank.jsx` / `Wallet.jsx` backed by `useBankStore`; admin side: `AdminFundRequests.jsx` / `AdminWithdrawals.jsx`.

### Market-data snapshots — what keeps screens populated when the feed is gone

The bridge is a *live* feed: it has nothing to give outside NEPSE's Sun–Thu 11:00–15:00 NPT window, or whenever the Bun service isn't running. Without a fallback the navbar ticker, index chart and landing page all blank out — which is most of the day.

- **`models/market_snapshot.py`** — `market_snapshots`, one JSONB row per feed keyed `live_market` / `market_summary` / `nepse_index`. The **raw** bridge payload is stored, so normalization stays in the routes and changing a normalizer doesn't invalidate stored data.
- **`service/snapshot.py`** — `save_snapshot(db, key, payload, min_write_interval=0)` (upsert; the interval lets request-path callers skip a write when the stored copy is still fresh, so a 30s browser poll isn't a 30s DB write) and `load_snapshot` → `(payload, captured_at)`. Both swallow errors: a snapshot failure must never break the request that produced it.
- **Writers:** the scheduler saves all three feeds each successful cycle; `/market/summary` and `/market/nepse-index` also write through (throttled to 60s).
- **Readers:** those two routes plus `/public/overview` serve the stored copy when the live call returns empty, adding **`is_stale: true`** and **`as_of: <iso>`**. `resolve_summary(db)` in `routes/market.py` is the shared helper — use it rather than calling the bridge directly, so every surface degrades identically.
- **`is_open` is recomputed from the clock** (`service/market_hours.py` `is_market_open_now()`, Sun–Thu 11:00–15:00 NPT, holidays not modelled) when serving a snapshot. Replaying the stored `"OPEN"` would claim the market is trading hours after it closed.
- **Depth cache:** `restore_market_cache()` warms `LIVE_MARKET_DEPTH` from the `live_market` snapshot at startup, and an empty scheduler cycle now **keeps** the existing cache instead of wiping it.
- Frontend renders `is_stale` via `components/ui/StaleBadge.jsx` (navbar, index chart, landing page). Never present stale prices as live.

### Order-book depth (`service/depth.py`)

The bridge's `/live-market` payload carries prices but **no order book** — not one of its ~350 entries has a `marketDepth` key. The engine used to look for depth there, always find nothing, and fall through to a synthetic ladder, so every fill was simulated even mid-session. Real books come only from the per-symbol `/depth/:symbol` endpoint.

`resolve_levels(symbol, side, reference_price) -> (levels, source)` is the single entry point, resolving through one ordered chain:

1. inline `marketDepth` on the cached market item (free; correct if a future bridge build ships books with `/live-market`);
2. the live `/depth/:symbol` endpoint — the real book, snapshotted on success under key `depth:<SYMBOL>`;
3. that stored snapshot, so a closed market or downed bridge still fills against real prices;
4. the synthetic ladder around the last traded price.

Two guards keep this honest, and both matter:

- **Stale books are band-limited.** Snapshot levels are only trusted inside NEPSE's ±10% circuit band around the *current* price. Filling a market buy against yesterday's Rs 200 ask when the stock now trades at Rs 260 would hand out free money. Levels outside the band are dropped; if a side empties, it simulates instead.
- **Levels are sorted best-first** (asks ascending, bids descending) before the engine walks them. The old code consumed the book in source order, which only works if the feed is pre-sorted.

Resolved books are RAM-cached per symbol (20s while trading, 300s when closed, 60s after a failed lookup) so a matcher cycle and a burst of orders don't each hit the bridge. Snapshot reads/writes use their own short-lived session so they can never interfere with the caller's trading transaction. `depth_source` is returned in the buy/sell API responses and recorded in the transaction description.

### Price alerts

`POST /alerts` stores `{stock, condition: ABOVE|BELOW, target_price, status: ACTIVE}`. `controller/alerts.py` rejects a target that is **already met** at creation time, so an alert never trips instantly. The `check_price_alerts` loop (60s, constant in `service/alert_checker.py` — not in `Settings`) compares `Stock.last_traded_price` against the target and flips ACTIVE → TRIGGERED with a `triggered_at` stamp, locking each row `with_for_update(skip_locked=True)` and re-checking status under the lock so a concurrent delete can't race.

**Notification is client-side polling, not push** — there is no websocket. `useAlertsStore` polls `GET /alerts` every 60s (matching the checker's cadence) whenever `AlertBell` (navbar) or `AlertToasts` (dashboard shell) is mounted; the poll is ref-counted so only one interval runs. A newly-TRIGGERED alert pops a toast once per session and raises the bell badge until acknowledged. Acknowledgement is stored **client-side** in `localStorage` under `alerts:seen:<email>` — the `Alert` model has no read/acknowledged column, so adding one would need a migration. Because the price column itself only refreshes every 300s (`update_all_stock_prices`), worst-case notification latency is ~6 minutes, not 60s.

### Password reset (OTP)

`auth/password_reset.py` implements a three-step flow — `POST /auth/forgot-password` (generate OTP, store hashed in `password_reset_otps`, email via `service/email.py`) → `POST /auth/verify-otp` → `POST /auth/reset-password`. Attempts are capped by `OTP_MAX_ATTEMPTS` and codes expire after `OTP_EXPIRY_MINUTES`. Handlers are sync `def` on purpose: FastAPI runs them in a threadpool so the blocking `smtplib` call doesn't stall the event loop.

## Frontend architecture

React 19 SPA. State lives in **Zustand stores** under `src/store/` — one per domain (`useAppStore` = auth/wallet/portfolio, plus `useOrder/useTrade/useWatchlist/useHistory/useAlerts/useBank/useAdminStore`). Components read/write these stores rather than passing props deep. Note `useOrderStore` and `useTradeStore` both hit `/trade/buy`+`/trade/sell` — check which one a component uses before changing either.

- **API layer:** `src/services/api.js`. Backend origin is hardcoded `http://localhost:8000` (`API_ORIGIN`). It also holds JWT helpers (`decodeToken`, `isTokenExpired`) and `assetUrl` for resolving backend-relative paths like `/uploads/...`. Auth is a JWT sent as a bearer token; the client decodes `exp` locally to detect expiry.
- **Pages** (`src/pages/`) are top-level routes (Landing, Login, Register, Dashboard, AdminDashboard); the dashboard's inner screens live under `src/components/dashboard/`. Routing is `react-router-dom` v7.

### Frontend conventions

- **Design language** (keep new UI consistent with it): Rs. currency formatting, slate/blue base with emerald (up) / rose (down), `rounded-xl`, `tabular-nums` for figures. Note a known inconsistency — some older screens use the `रू` symbol instead of `Rs.`.
- **Charts:** `recharts` and `lightweight-charts` are installed. recharts is heavy (~780kB) and is not lazy-loaded — lazy-load chart routes when adding to them.

## nepse-bridge

Single-file Bun server (`nepse-bridge/index.ts`) on port 3000. Each route wraps one `nepse-api-unofficial` call and returns JSON. Routes the backend relies on include `/live-market`, `/depth/:symbol`, `/nepse-index` (intraday with daily-history fallback), `/market-summary`. Run with `bun run index.ts`; deps install with `bun install`.

**Bun-only convention** (from `nepse-bridge/.cursor/rules/`): inside this service use Bun for everything — `bun <file>` (not `node`/`ts-node`), `bun install`, `bun run`, `bunx`, and `bun test` (not jest/vitest) for any tests. Prefer Bun's built-ins over npm packages: `Bun.serve()` (not express), `Bun.sql` for Postgres (not `pg`), `Bun.file` over `node:fs`. Bun auto-loads `.env`, so don't add `dotenv`.
