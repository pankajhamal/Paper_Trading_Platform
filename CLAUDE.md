# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A NEPSE (Nepal Stock Exchange) paper-trading simulator. Users trade Nepali stocks with virtual money (wallet starts at Rs 100,000) against real live market data. It is three independent services that must run together:

- **`backend/`** — FastAPI + SQLAlchemy + PostgreSQL (the core: auth, order matching, escrow, wallet, portfolio). Serves on `:8000`.
- **`frontend/`** — React 19 + Vite + Zustand + Tailwind 4 SPA. Dev server on `:5173`.
- **`nepse-bridge/`** — Bun + TypeScript. Thin HTTP wrapper around the `nepse-api-unofficial` package. Serves on `:3000`.

Data flows one direction: `nepse-bridge` pulls from NEPSE → `backend` consumes the bridge over HTTP → `frontend` calls the backend. The frontend never talks to the bridge directly.

## Running the stack

All three services must be up for live data to work. Start them in separate terminals.

```bash
# 1. nepse-bridge  (port 3000) — start FIRST, backend depends on it
cd nepse-bridge && bun install && bun run index.ts

# 2. backend  (port 8000)
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload        # docs at http://localhost:8000/docs

# 3. frontend  (port 5173)
cd frontend && npm install
npm run dev        # build: npm run build | lint: npm run lint (oxlint) | preview: npm run preview
```

The backend needs a `backend/.env` (gitignored). Required keys are defined in `backend/app/database/config.py`: `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRES_MINUTES`. That same `Settings` class also exposes order-lifecycle tuning worth knowing: `ORDER_EXPIRY_MINUTES` (default 360 ≈ a trading day — drop to ~2 to demo expiry), `MATCHER_INTERVAL_SECONDS`, `EXPIRY_SCAN_INTERVAL_SECONDS`, and the seeded default-admin credentials.

There is no test suite in the repo yet.

## Database & migrations — read this before touching a model

The app calls `Base.metadata.create_all()` on startup (`backend/app/main.py`), which **only creates missing tables — it never ALTERs existing ones**. Alembic (`backend/alembic/`, config in `backend/alembic.ini`) is the source of truth for schema *changes*.

- Adding a column to an existing table requires a migration; `create_all` will not apply it, and forgetting this has caused hand-run `ALTER TABLE` statements against the live DB.
- Migration commands (from `backend/`): `alembic revision --autogenerate -m "msg"`, then `alembic upgrade head`.

## Backend architecture

FastAPI app is assembled in `app/main.py`: it mounts routers, enables CORS for the Vite origins, serves uploaded avatars as static files at `/uploads`, and on startup seeds the default admin then launches **four asyncio background loops** — internalize these, they drive most of the "things happen on their own" behavior:

- `service/schedular.py` `update_all_stock_prices` — periodically pulls the whole market from the bridge and refreshes the in-RAM price/depth cache.
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
- **Market depth:** matching walks live depth from the RAM cache; when a symbol has no live depth (market closed / unavailable) it falls back to `generate_simulated_depth`. `NepseService.get_market_depth` normalizes the bridge's raw keys (e.g. `orderBookOrderPrice` → `price`) into standard `{price, quantity}` levels.
- **NEPSE rules to enforce:** ±10% circuit filter on price, and Rs 0.10 tick size.
- **Known money-precision gap:** wallet balance is `Numeric(12,2)`, but buy/sell/cancel/matcher still `float()`-cast before writing, so float rounding is not fully eliminated. Prefer `Decimal` when adding new money math.

Portfolio rows are unique per `(user_id, stock_id)`. NEPSE market hours (used for the open/closed status) are Sun–Thu, 11:00–15:00 NPT.

## Frontend architecture

React 19 SPA. State lives in **Zustand stores** under `src/store/` — one per domain (`useAppStore` = auth/wallet/portfolio, plus `useOrder/useTrade/useWatchlist/useHistory/useAlerts/useAdminStore`). Components read/write these stores rather than passing props deep.

- **API layer:** `src/services/api.js`. Backend origin is hardcoded `http://localhost:8000` (`API_ORIGIN`). It also holds JWT helpers (`decodeToken`, `isTokenExpired`) and `assetUrl` for resolving backend-relative paths like `/uploads/...`. Auth is a JWT sent as a bearer token; the client decodes `exp` locally to detect expiry.
- **Pages** (`src/pages/`) are top-level routes (Landing, Login, Register, Dashboard, AdminDashboard); the dashboard's inner screens live under `src/components/dashboard/`. Routing is `react-router-dom` v7.

### Frontend conventions

- **Design language** (keep new UI consistent with it): Rs. currency formatting, slate/blue base with emerald (up) / rose (down), `rounded-xl`, `tabular-nums` for figures. Note a known inconsistency — some older screens use the `रू` symbol instead of `Rs.`.
- **Charts:** `recharts` and `lightweight-charts` are installed. recharts is heavy (~780kB) and is not lazy-loaded — lazy-load chart routes when adding to them.

## nepse-bridge

Single-file Bun server (`nepse-bridge/index.ts`) on port 3000. Each route wraps one `nepse-api-unofficial` call and returns JSON. Routes the backend relies on include `/live-market`, `/depth/:symbol`, `/nepse-index` (intraday with daily-history fallback), `/market-summary`. Run with `bun run index.ts`; deps install with `bun install`.

**Bun-only convention** (from `nepse-bridge/.cursor/rules/`): inside this service use Bun for everything — `bun <file>` (not `node`/`ts-node`), `bun install`, `bun run`, `bunx`, and `bun test` (not jest/vitest) for any tests. Prefer Bun's built-ins over npm packages: `Bun.serve()` (not express), `Bun.sql` for Postgres (not `pg`), `Bun.file` over `node:fs`. Bun auto-loads `.env`, so don't add `dotenv`.
