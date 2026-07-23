# PaperTrade — NEPSE Paper Trading Platform

A full-stack **paper-trading simulator for the Nepal Stock Exchange (NEPSE)**.
Practice buying and selling Nepali stocks with virtual money against **real,
live market data** — no TMS account, no real capital, and zero risk.

> Not affiliated with NEPSE, CDSC, or SEBON. All trades are simulated and for
> educational use only.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [Domain Rules](#domain-rules)
- [Project Structure](#project-structure)

---

## Features

- **Live NEPSE data** — prices, market depth, and the index are pulled from the
  live market via a dedicated bridge service.
- **Realistic order engine** — market & limit orders matched against live (or
  simulated) market depth, with partial fills, a **±10% circuit filter**, and
  **Rs 0.10 tick size** enforced.
- **Escrow-based lifecycle** — resting limit orders hold cash/shares; a
  background matcher fills them, an expiry job returns escrow on day-order
  timeout, and manual cancel reverses it — all race-safe with row locks.
- **Wallet & E-Bank** — each account starts with **Rs 1,00,000** in the trading
  wallet plus a **Rs 1,00,000 e-bank**. Load funds bank → wallet, and request
  more with **admin approval**.
- **Withdrawals** — move cash wallet → bank via an admin-approved request
  (debited only on approval).
- **Portfolio, watchlist, price alerts, transaction history, and analytics
  charts.**
- **Admin panel** — platform overview, user management, and approval queues for
  money requests and withdrawals.
- **Public landing page** with a real-time market snapshot (index, top movers,
  live ticker).
- **Secure auth** — JWT (OAuth2) with bcrypt-hashed passwords, role-based admin
  gating, and DB-level integrity constraints.

---

## Architecture

Three independent services communicate over HTTP. Data flows one direction:
the bridge pulls from NEPSE, the backend consumes the bridge, and the frontend
calls the backend.

```
┌──────────────┐     HTTP      ┌──────────────┐     HTTP      ┌──────────────┐
│  frontend    │ ────────────► │   backend    │ ────────────► │ nepse-bridge │ ──► NEPSE
│  React SPA   │   :8000 API   │   FastAPI    │  :3000 data   │   Bun/TS     │
│    :5173     │ ◄──────────── │    :8000     │ ◄──────────── │    :3000     │
└──────────────┘               └──────┬───────┘               └──────────────┘
                                      │
                                ┌─────▼──────┐
                                │ PostgreSQL │
                                └────────────┘
```

- **`backend/`** — FastAPI + SQLAlchemy + PostgreSQL. Auth, the order-matching
  engine, wallet/e-bank/escrow logic, admin, and four asyncio background loops
  (market sync, limit-order matcher, order expiry, price alerts).
- **`frontend/`** — React 19 SPA (Vite + Zustand + Tailwind). Trading workspace,
  admin panel, and the public landing page.
- **`nepse-bridge/`** — Bun + TypeScript service wrapping `nepse-api-unofficial`,
  exposing live-market, depth, index, and summary endpoints.

---

## Tech Stack

| Layer     | Technologies                                                                    |
| --------- | ------------------------------------------------------------------------------- |
| Backend   | FastAPI, SQLAlchemy 2, PostgreSQL, Alembic, Pydantic v2, python-jose, passlib/bcrypt, httpx, pytest |
| Frontend  | React 19, Vite, Zustand, Axios, Tailwind CSS 4, React Router 7, Recharts, lucide-react, oxlint |
| Bridge    | Bun, TypeScript, nepse-api-unofficial                                           |

---

## Prerequisites

- **Python 3.12+** and **PostgreSQL 14+**
- **Node.js 20+** (frontend)
- **[Bun](https://bun.sh)** (nepse-bridge)

Create the database before first run:

```bash
createdb papertrading
```

---

## Getting Started

Clone the repository, then set up each service. All three must be running for
live data to work — **start the bridge first**, as the backend depends on it.

### 1. nepse-bridge (port 3000)

```bash
cd nepse-bridge
bun install
bun run index.ts
```

### 2. backend (port 8000)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
# create backend/.env with the keys documented in "Environment Variables" below
alembic upgrade head               # apply database migrations
uvicorn app.main:app --reload      # API docs at http://localhost:8000/docs
```

### 3. frontend (port 5173)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

A default admin account is seeded on first startup from your `.env`
(`DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`).

---

## Environment Variables

Create `backend/.env` with the following keys (see `app/database/config.py`):

```dotenv
# Database
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5432/papertrading

# Auth — use a long, random secret in any real deployment
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(64))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRES_MINUTES=60

# Default admin (seeded on startup). Password has NO code default — it must be set here.
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=<a strong password>
DEFAULT_ADMIN_NAME=Administrator

# Order lifecycle tuning (optional — defaults shown)
ORDER_EXPIRY_MINUTES=360          # day-order lifetime; lower to demo expiry
MATCHER_INTERVAL_SECONDS=10       # how often the limit-order matcher runs
EXPIRY_SCAN_INTERVAL_SECONDS=30   # how often expired orders are swept
```

> **Security note:** `SECRET_KEY` signs JWTs and `DEFAULT_ADMIN_PASSWORD`
> bootstraps the admin — never commit `.env` or ship weak values.

---

## Running the App

Once all three services are up:

1. Open **http://localhost:5173** for the landing page.
2. Register an account (starts with Rs 1,00,000 wallet + Rs 1,00,000 e-bank), or
   log in as the seeded admin to reach the admin panel.
3. Load funds from the E-Bank into your wallet, then place buy/sell orders on the
   Market screen.

Interactive API documentation is available at **http://localhost:8000/docs**.

---

## Testing

The backend ships with a pytest suite covering the core money invariants
(escrow round-trip, circuit filter, tick size):

```bash
cd backend
source venv/bin/activate
python -m pytest
```

Frontend lint and production build:

```bash
cd frontend
npm run lint     # oxlint
npm run build
```

---

## Domain Rules

- **Starting balance:** Rs 1,00,000 (trading wallet) + Rs 1,00,000 (e-bank).
- **Circuit filter:** limit orders must be within ±10% of the last traded price.
- **Tick size:** prices must be multiples of Rs 0.10.
- **Market hours:** Sunday–Thursday, 11:00–15:00 NPT (used for open/closed status).
- **Escrow:** buys hold cash (`remaining_qty × limit_price`); sells hold shares
  (`remaining_qty`). Reversals (cancel, expiry, matcher refund) recompute the
  exact held amount. DB `CHECK` constraints prevent negative balances/quantities.

---

## Project Structure

```
Paper_Trading_Platform/
├── backend/                 # FastAPI service
│   ├── app/
│   │   ├── auth/            # JWT login/register, dependencies
│   │   ├── controller/     # order-matching engine (buy/sell/cancel)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # HTTP routers (trade, user, admin, market, public…)
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── service/        # background loops, market cache, bridge client
│   │   └── main.py         # app entrypoint + startup tasks
│   ├── alembic/            # database migrations
│   └── tests/              # pytest suite
├── frontend/                # React SPA
│   └── src/
│       ├── components/     # dashboard, admin, layout components
│       ├── pages/          # Landing, Login, Register, Dashboard, Admin
│       ├── store/          # Zustand stores (one per domain)
│       └── services/       # Axios API client
└── nepse-bridge/            # Bun/TypeScript NEPSE data bridge
```

---

## License

Educational project. Simulated data only — not financial advice, and not
affiliated with NEPSE, CDSC, or SEBON.
