# PaperTrade — NEPSE Paper Trading Platform
## Final Year Project Report — Source Context Document

> **How to use this document.** This is not the report itself; it is the complete,
> verified context from which the report is written. Every figure, table, and
> claim below was extracted from the running codebase and database on
> **2026-07-26**, not from memory or estimation. Sections marked
> **⟨FILL IN⟩** require information only you can supply (name, campus,
> supervisor, dates). Sections marked **⚠ Honesty note** flag things that are
> *not* implemented or are known-broken — state these in the Limitations chapter
> rather than claiming them as features. An external examiner will open the code.

---

## Table of Contents

1. [Project Identification](#1-project-identification)
2. [Abstract](#2-abstract)
3. [Introduction & Problem Statement](#3-introduction--problem-statement)
4. [Objectives](#4-objectives)
5. [Scope and Limitations](#5-scope-and-limitations)
6. [Literature Review & Background](#6-literature-review--background)
7. [Methodology](#7-methodology)
8. [System Architecture](#8-system-architecture)
9. [Database Design](#9-database-design)
10. [Detailed Design: Algorithms](#10-detailed-design-algorithms)
11. [Module-by-Module Implementation](#11-module-by-module-implementation)
12. [API Reference](#12-api-reference)
13. [Security Implementation](#13-security-implementation)
14. [Testing](#14-testing)
15. [Results & Project Metrics](#15-results--project-metrics)
16. [Known Limitations](#16-known-limitations-state-these-honestly)
17. [Future Enhancements](#17-future-enhancements)
18. [Diagrams to Draw](#18-diagrams-you-need-to-draw)
19. [Suggested Report Structure](#19-suggested-report-chapter-structure)
20. [References](#20-references)

---

## 1. Project Identification

| Field | Value |
|---|---|
| Project title | PaperTrade — A Risk-Free NEPSE Paper Trading Simulator |
| Domain | Financial technology / Web engineering |
| Student | ⟨FILL IN⟩ |
| Roll / Registration no. | ⟨FILL IN⟩ |
| Programme & Semester | ⟨FILL IN⟩ |
| Campus / University | ⟨FILL IN⟩ |
| Supervisor | ⟨FILL IN⟩ |
| Development period | 2026-05-27 to 2026-07-24 (43 commits on `main`) |
| Repository | `Paper_Trading_Platform` (Git, branch `main`) |

---

## 2. Abstract

Use this as raw material; rewrite in your own voice to roughly 200–250 words.

PaperTrade is a full-stack web application that lets users learn to trade on the
Nepal Stock Exchange (NEPSE) using virtual money against real market data. Each
account is credited with a simulated trading wallet of Rs 1,00,000 and a
separate simulated e-bank account of Rs 1,00,000, and can place **market** and
**limit** orders on any of the 388 listed securities the system tracks. Unlike a
naive simulator that fills every order instantly at the last traded price, the
system implements a genuine matching engine: orders are executed by walking a
real NEPSE order book level by level, producing **partial fills** and a
**volume-weighted average execution price**. Unfilled limit orders rest on the
book and are filled asynchronously by a background matching service when the
market reaches their price. Capital committed to a resting order is held in
**escrow** — cash for buys, shares for sells — and is released exactly on
cancellation or day-order expiry, with race conditions between the matcher and a
concurrent cancellation prevented by row-level database locking. NEPSE's
regulatory constraints are enforced at order entry: a **±10% circuit filter** and
a **Rs 0.10 tick size**. Because the live NEPSE feed is only available Sunday to
Thursday, 11:00–15:00 NPT, the system persists every successful market payload
as a JSONB snapshot and degrades to that snapshot when the feed is unavailable,
labelling such data as stale rather than presenting it as live. The system is
built as three cooperating services — a FastAPI/PostgreSQL backend, a React 19
single-page frontend, and a Bun/TypeScript data bridge — comprising
approximately 13,900 lines of code and validated by 16 automated integration
tests.

**Keywords:** NEPSE, paper trading, order matching engine, limit order book,
escrow, FastAPI, React, PostgreSQL, financial simulation.

---

## 3. Introduction & Problem Statement

### 3.1 Context

The Nepal Stock Exchange has seen rapid retail participation growth, with
account opening driven largely by first-time investors. Trading is conducted
through the Trade Management System (TMS) operated by licensed brokers, which
requires a Demat account, a broker relationship, and real capital. There is no
official sandbox in which a prospective investor can learn the mechanics of order
placement before committing money.

### 3.2 The problem

A new NEPSE investor faces three distinct barriers, and this project addresses
the second and third:

1. **Capital risk** — mistakes made while learning cost real money.
2. **Mechanical unfamiliarity** — the difference between a market and a limit
   order, what a circuit filter does, why an order rests unfilled, what partial
   fill means, and how tick size constrains a price are all learned by doing.
   There is nowhere safe to do them.
3. **Absence of realistic practice tools** — generic international stock
   simulators do not model NEPSE-specific rules (the ±10% circuit band, the
   Rs 0.10 tick, the Sunday–Thursday 11:00–15:00 session) and do not carry
   Nepali securities.

### 3.3 The proposed solution

A web platform that reproduces the *mechanics* of NEPSE trading faithfully while
removing the capital risk entirely. The design principle throughout was
**mechanical realism over convenience**: wherever a shortcut would have made the
simulation easier but less truthful, the harder path was taken. Three concrete
examples, each defensible in a viva:

- Orders are **matched against a real order book**, not filled at the last
  traded price. This is what produces partial fills and a weighted average price.
- Committed capital is **escrowed**, so a user cannot spend the same rupee on two
  resting orders — the failure mode a naive simulator has.
- Stale market data is **labelled stale**, never replayed as if live.

---

## 4. Objectives

### 4.1 General objective

To design, implement, and test a web-based paper-trading simulator that lets a
user practise NEPSE equity trading with virtual capital against real market data,
reproducing the exchange's order types, matching behaviour, and regulatory price
constraints.

### 4.2 Specific objectives

1. To integrate a live NEPSE market data feed (prices, per-symbol order book
   depth, and the NEPSE index) into the application.
2. To implement an order-matching engine supporting market and limit orders with
   partial fills against multi-level order book depth.
3. To implement an escrow mechanism that reserves cash for buy orders and shares
   for sell orders, and releases the reserved amount exactly on cancellation,
   expiry, or fill.
4. To enforce NEPSE's ±10% circuit filter and Rs 0.10 tick size at order entry.
5. To provide asynchronous background services for limit-order matching, day-order
   expiry, price-alert evaluation, and periodic market synchronisation.
6. To implement a resilience layer that keeps the application functional outside
   market hours by persisting and serving the last known good market data, with
   explicit staleness labelling.
7. To implement secure JWT-based authentication with role-based access control,
   an email-OTP password reset flow, and an administrative approval workflow for
   simulated fund movements.
8. To validate the correctness of the money-handling and depth-resolution logic
   through automated integration tests.

---

## 5. Scope and Limitations

### 5.1 In scope

- Equity (share) trading only.
- Market orders and day limit orders.
- Simulated cash management: trading wallet, simulated e-bank, admin-approved
  top-up requests and withdrawals.
- Portfolio with weighted-average cost basis, watchlist, price alerts,
  transaction history, and analytics charts.
- Administrative panel: platform overview, user enable/disable, and the two
  approval queues.
- Public landing page carrying a live market overview for unauthenticated
  visitors.

### 5.2 Out of scope

- Real money, real brokerage, and any CDSC/Demat integration.
- Derivatives, mutual funds, bonds, IPO/FPO application, and rights shares.
- Brokerage commission, SEBON fee, DP charge, and capital gains tax modelling
  (**⚠ Honesty note:** execution cost is currently gross, with no fees deducted).
- NEPSE public holidays (only the weekly Sunday–Thursday schedule is modelled).
- Mobile native applications.
- Multi-user order crossing — users trade against the *exchange* book, never
  against each other. Two PaperTrade users cannot fill one another's orders.

---

## 6. Literature Review & Background

Cover these five areas. The first three are domain theory you must cite; the last
two are what you actually built on.

### 6.1 Order types and the limit order book

Define, with an example each: market order, limit order, the bid–ask spread,
market depth, marketable vs. resting limit orders, and partial fill. The single
most important conceptual point for your viva: **a limit order executes
immediately if it crosses the spread** — a buy limit at or above the best ask is
marketable and fills at once; it only rests if it is priced below the best ask.
This is not a defect, and your system demonstrates it correctly (see §10.1).

### 6.2 Continuous auction matching and price–time priority

Real exchanges match on price priority then time priority. Document what your
system does and does not do: it implements **price priority** (the book is sorted
best-first and consumed cheapest-ask/highest-bid first), but since users trade
against the exchange book rather than a shared internal book, **time priority
between two PaperTrade users does not arise**. Say this explicitly.

### 6.3 NEPSE market microstructure

Cite NEPSE/SEBON sources for: the trading session (Sunday–Thursday, 11:00–15:00
NPT), the ±10% daily circuit filter, the Rs 0.10 tick size, and the TMS-based
broker-mediated access model.

### 6.4 Comparison with existing systems

Suggested comparison table for the report:

| System | Market | Real data | Order book matching | NEPSE rules | Escrow |
|---|---|---|---|---|---|
| Investopedia Simulator | US | Delayed | Simplified | No | Partial |
| TradingView paper trading | Global | Live | Simulated fill | No | No |
| Moneybhai (India) | India | Delayed | No (LTP fill) | No | No |
| Generic NEPSE portfolio trackers | Nepal | Live prices | None (tracking only) | No | No |
| **PaperTrade (this project)** | **Nepal** | **Live** | **Multi-level depth walk** | **Yes (±10%, Rs 0.10)** | **Yes** |

Verify each competitor row yourself before submitting — do not cite this table
without checking, as these products change.

### 6.5 Technology review

Justify each choice rather than merely listing it:

- **FastAPI** — native `async`/`await` was required because four background
  services run concurrently in-process alongside the HTTP server, and the market
  data client is I/O-bound. Automatic OpenAPI documentation at `/docs` was a
  secondary benefit.
- **PostgreSQL** — chosen specifically for `SELECT … FOR UPDATE` row-level
  locking, which the escrow race protection depends on, and for `JSONB`, which
  stores raw market payloads without schema migration on every feed change.
- **React 19 + Zustand** — Zustand over Redux for substantially less boilerplate
  in a project of this size; state is split one store per domain.
- **Bun** — the `nepse-api-unofficial` package is JavaScript-only, so a small
  TypeScript service was needed to expose it to the Python backend over HTTP.
  Bun was chosen for a fast single-file server with a built-in TypeScript runtime.

---

## 7. Methodology

### 7.1 Development model

Incremental and iterative. Each increment delivered one vertical slice
(database model → backend logic → API → UI). The Git history (43 commits over
roughly two months) shows this progression and can be reproduced for the report
with `git log --oneline --reverse`.

The seven Alembic migrations mark the major increments, in order:

| # | Revision | Increment delivered |
|---|---|---|
| 1 | `5de875aaa9ce` | Initial schema — users, wallet, stocks, portfolio, transactions |
| 2 | `0605fffa5c5a` | Orders table (trading capability) |
| 3 | `64aa07c97bb3` | `symbol` and limit columns on orders (limit orders + escrow) |
| 4 | `b1f0e2a7c4d9` | E-bank and fund requests (admin-approved money flow) |
| 5 | `c2d4a6b8e0f1` | Non-negative `CHECK` constraints on money/quantity columns |
| 6 | `d3e5b7c9f2a1` | Password reset OTP table |
| 7 | `e4f6c8d0a3b2` | Market snapshots (offline resilience) |

This is a genuinely strong narrative device: migration 5 is a *defensive* increment
added after the money logic existed, and migration 7 is a *resilience* increment
added after the feed's real-world availability was measured. Use them to show
the design evolving in response to observed problems.

### 7.2 Requirement analysis

**Functional requirements** (derive the numbered FR list from §12's endpoint
inventory — every endpoint maps to one functional requirement).

**Non-functional requirements**, as actually implemented:

| NFR | Implementation |
|---|---|
| Correctness of money handling | Escrow invariant + DB `CHECK` constraints + 16 automated tests |
| Concurrency safety | `SELECT … FOR UPDATE (SKIP LOCKED)` with re-validation under lock |
| Availability outside market hours | JSONB snapshot fallback with staleness labelling |
| Responsiveness | Depth books RAM-cached (20 s open / 300 s closed); bridge calls bounded by an 8-permit semaphore |
| Security | bcrypt password hashing, JWT bearer auth, role-gated admin router |
| Auditability | Every money movement writes a `transactions` row |

### 7.3 Tools

| Purpose | Tool |
|---|---|
| Backend language / runtime | Python 3.14.6 |
| Backend framework | FastAPI, Uvicorn (ASGI) |
| ORM / migrations | SQLAlchemy 2.x, Alembic |
| Database | PostgreSQL (`papertrading`) |
| Frontend | React 19.2, Vite 8, Tailwind CSS 4, Zustand 5, React Router 7 |
| Charting | Recharts 3.9, Lightweight Charts 5.2 |
| Bridge | Bun, TypeScript, `nepse-api-unofficial` |
| Testing | pytest 9.1.1 (backend), oxlint (frontend) |
| Email (development) | Mailtrap sandbox SMTP |
| Version control | Git |

---

## 8. System Architecture

### 8.1 Three-tier service decomposition

```
┌──────────────┐    HTTP/JSON   ┌──────────────┐   HTTP/JSON   ┌──────────────┐
│  frontend    │ ─────────────► │   backend    │ ────────────► │ nepse-bridge │ ──► NEPSE
│  React 19    │   REST + JWT   │   FastAPI    │  market data  │   Bun / TS   │
│    :5173     │ ◄───────────── │    :8000     │ ◄──────────── │    :3000     │
└──────────────┘                └──────┬───────┘               └──────────────┘
                                       │ SQLAlchemy
                                 ┌─────▼──────┐
                                 │ PostgreSQL │
                                 └────────────┘
```

**Data flows in one direction only.** The frontend never contacts the bridge
directly. This is an architectural decision worth defending in the viva: it keeps
a single authentication and authorisation boundary at the backend, allows the
backend to cache and snapshot market data centrally for all clients, and means
the upstream data source can be replaced without touching the frontend.

Startup order matters: the bridge must be running before the backend, because the
backend's first market synchronisation happens at startup.

### 8.2 Why a separate bridge service exists

The only maintained NEPSE data library, `nepse-api-unofficial`, is a JavaScript
package with no Python equivalent. Rather than reimplement NEPSE's request
signing in Python, a 142-line Bun service wraps the library and exposes four
JSON endpoints. This is a **language-boundary adapter** — a legitimate and
citable architectural pattern (an Anti-Corruption Layer in Domain-Driven Design
terms). It also isolates an unofficial, unstable upstream dependency behind a
contract the backend controls.

Bridge endpoints consumed by the backend:

| Endpoint | Returns |
|---|---|
| `GET /live-market` | Whole-market price rows (~350–390 securities) |
| `GET /depth/:symbol` | Per-symbol order book (bid and ask ladders) |
| `GET /nepse-index` | Intraday index series, with daily-history fallback |
| `GET /market-summary` | Aggregate turnover / traded shares / transactions |

### 8.3 Backend internal layering

```
routes/     HTTP layer — thin, no business logic, injects dependencies
   │
   ▼
controller/ business logic — buy, sell, cancel, orders, alerts, watchlist
   │
   ▼
service/    background loops, market cache, depth resolution, bridge client
   │
   ▼
models/     SQLAlchemy ORM  ──►  PostgreSQL
```

A strict rule is enforced: **routes contain no business logic and never commit**.
The `get_db` dependency yields a session and closes it, but does not commit or
roll back — controllers own transaction boundaries. This gives one place per
operation where the transaction begins and ends.

### 8.4 The four background services

All four are launched as `asyncio` tasks at application startup and run for the
process lifetime. Each opens its own short-lived database session per cycle.
**This is the single most distinctive part of the architecture** — most student
CRUD projects are purely request-driven, and things happening autonomously is
what makes this a simulator rather than a form over a database.

| Service | File | Interval | Responsibility |
|---|---|---|---|
| Market synchroniser | `service/schedular.py` | 300 s (hardcoded) | Pull whole market from bridge, refresh RAM price cache, upsert every `Stock` row, save snapshot |
| Matching engine | `service/matcher.py` | 10 s (`MATCHER_INTERVAL_SECONDS`) | Fill resting limit orders when the book reaches their price |
| Expiry sweeper | `service/expiration.py` | 30 s (`EXPIRY_SCAN_INTERVAL_SECONDS`) | Expire day orders older than `ORDER_EXPIRY_MINUTES` (default 360) and refund escrow |
| Alert checker | `service/alert_checker.py` | 60 s (module constant) | Trip ACTIVE price alerts to TRIGGERED |

---

## 9. Database Design

### 9.1 Overview

14 application tables plus Alembic's `alembic_version`. Live row counts as of
2026-07-26 (useful evidence that the system has actually been exercised):

| Table | Rows | Purpose |
|---|---|---|
| `users` | 20 | Accounts, role, soft-delete flag |
| `wallet` | 20 | Trading cash balance (1:1 with user) |
| `bank_accounts` | 20 | Simulated e-bank balance (1:1 with user) |
| `stocks` | 388 | Securities master + latest price snapshot |
| `portfolio` | 21 | Holdings, unique per (user, stock) |
| `orders` | 46 | Order lifecycle records |
| `transactions` | 104 | Append-only money/asset audit log |
| `withdrawal_requests` | 7 | Wallet → bank, admin-approved |
| `fund_requests` | 4 | Bank top-up, admin-approved |
| `alerts` | 6 | Price alerts |
| `watchlist` | 7 | Tracked symbols |
| `password_reset_otps` | 4 | Hashed OTPs for password reset |
| `market_snapshots` | 18 | Last-known-good market payloads (JSONB) |

### 9.2 Core schema

**`users`** — `user_id` PK, `full_name`, `email` (UNIQUE), `password` (bcrypt
hash), `role` (`"user"` / `"admin"`, plain string, no enum), `avatar_url`,
`is_active` (soft delete; a disabled user gets 403 rather than being deleted, so
their audit trail survives).

**`wallet`** — `wallet_id` PK, `user_id` (UNIQUE FK), `balance`, timestamps.
`CHECK (balance >= 0)`.

**`bank_accounts`** — `id` PK, `user_id` (UNIQUE FK), `balance NUMERIC(12,2)`
default 100000, `bank_name` default `'NIC Asia Bank'`.
`CHECK (balance >= 0)`.

**`stocks`** — `stock_id` PK, `symbol` (UNIQUE, indexed), `company_name`,
`last_traded_price`, `change`, `percent_change`, OHLC, `volume`, `last_updated`.
`last_traded_price` is the reference price for the circuit filter.

**`portfolio`** — `portfolio_id` PK, `user_id` FK, `stock_id` FK, `quantity`,
`average_price NUMERIC(12,2)`, timestamps.
`UNIQUE (user_id, stock_id)` as `uq_user_stock` — one row per holding, so a
second buy of the same stock updates the weighted average rather than inserting a
duplicate. `CHECK (quantity >= 0)`.

**`orders`** — `order_id` PK, `user_id` FK, `stock_id` FK, `symbol`,
`order_type` (`MARKET`/`LIMIT`), `transaction_type` (`BUY`/`SELL`), `quantity`,
`remaining_quantity`, `limit_price NUMERIC(12,2)` (NULL for market orders),
`status`, `created_at`.
`CHECK (quantity >= 0)`, `CHECK (remaining_quantity >= 0)`.

**`transactions`** — append-only audit log. `type` is one of `BUY`, `SELL`,
`ESCROW_HOLD`, `ESCROW_RELEASE`, `ASSET_ESCROW_HOLD`, `ASSET_ESCROW_RELEASE`,
`DEPOSIT`, `WITHDRAW`. **Balances are never derived from this table** — it exists
for traceability only. Make this explicit in the report; an examiner may ask
whether you built an event-sourced ledger, and you did not.

**`market_snapshots`** — `key` (PK, e.g. `live_market`, `market_summary`,
`nepse_index`, `depth:NABIL`), `payload JSONB`, `captured_at`. The **raw** bridge
response is stored verbatim so that changing a parser does not invalidate stored
data.

### 9.3 State vocabularies

All statuses are plain strings, not database enums.

| Entity | States |
|---|---|
| `Order.status` | `PENDING` → `COMPLETED` \| `CANCELLED` \| `EXPIRED` |
| `Alert.status` | `ACTIVE` → `TRIGGERED` |
| `WithdrawalRequest.status` | `PENDING` → `APPROVED` \| `REJECTED` |
| `FundRequest.status` | `PENDING` → `APPROVED` \| `REJECTED` |

### 9.4 Referential integrity

16 foreign keys. User-owned data (`alerts`, `watchlist`, `portfolio`,
`fund_requests`, `password_reset_otps`, `withdrawal_requests`) cascades on user
delete; `orders`, `transactions`, and `wallet` deliberately do **not** cascade,
preserving the financial audit trail. Both approval-queue tables carry a second
FK, `reviewed_by → users(user_id)`, requiring an explicit `foreign_keys=`
declaration on the SQLAlchemy relationship because two FKs point at the same table.

### 9.5 Defence in depth: database-level CHECK constraints

Six `CHECK` constraints (migration `c2d4a6b8e0f1`) enforce non-negative balances
and quantities. The rationale is a good exam answer: the application already
validates sufficiency before every debit, but a logic error in a future change
would silently corrupt a balance. With the constraint, such a bug surfaces
immediately as an `IntegrityError` and the transaction rolls back, so the
database can never hold a negative balance regardless of application defects.

### 9.6 Schema evolution policy

`Base.metadata.create_all()` runs at startup, but it **only creates missing
tables — it never ALTERs existing ones**. All schema *changes* therefore go
through Alembic. Document this; it is a real operational pitfall in the project
(see §16.1).

---

## 10. Detailed Design: Algorithms

These four algorithms are the intellectual core of the project. Give each a
flowchart or pseudocode listing in the report.

### 10.1 Order matching — walking the book

Input: symbol, quantity, order type, limit price (if limit).

```
1. Validate the stock exists.
2. If LIMIT:
     a. Reject if limit_price outside [LTP × 0.90, LTP × 1.10]   (circuit filter)
     b. Reject if (limit_price × 10) mod 1 ≠ 0                   (Rs 0.10 tick)
3. Resolve the book:  BUY → ask levels;  SELL → bid levels.
   Levels arrive sorted best-first (asks ascending, bids descending).
4. remaining ← quantity;  executed_value ← 0
   For each level in the book:
       if remaining = 0: break
       if LIMIT and BUY  and level.price > limit_price: break
       if LIMIT and SELL and level.price < limit_price: break
       take ← min(remaining, level.quantity)
       executed_value ← executed_value + take × level.price
       remaining ← remaining − take
5. If MARKET and remaining > 0: reject (insufficient market liquidity).
6. escrow ← (LIMIT and remaining > 0) ? remaining × limit_price : 0
7. Persist atomically: debit/credit, update portfolio, log transactions,
   write the order with status = (remaining = 0 ? COMPLETED : PENDING).
```

**Two properties to highlight in the report.**

*Partial fill and weighted average price.* If a level holds fewer shares than
requested, only that many are taken and the walk continues to the next, worse
price. The reported execution price is therefore
`executed_value / filled_quantity` — a genuine VWAP, not the last traded price.

*Marketable limit orders execute immediately.* A buy limit priced at or above the
best ask crosses the spread and fills at once, at the **ask price, not the limit
price** — the buyer receives price improvement. A worked example verified in the
live system on 2026-07-26 is excellent report material:

> NABIL, last traded price Rs 553.10. Resolved ask book: 554.0×280, 554.5×50,
> 554.7×130. Three limit buy orders were placed at Rs 555, Rs 600, and Rs 608
> (orders #57, #58, #59). All three completed immediately, each filling
> 10 shares at **Rs 554.00** — the best ask — for Rs 5,540, not at the submitted
> limit price. Meanwhile limit **sell** orders at Rs 560 and Rs 608 (orders #60,
> #61) rested as PENDING, because the best bid was only Rs 553.50. The apparent
> asymmetry is correct exchange behaviour: both orders were priced above the
> market, which makes a buy marketable and a sell non-marketable.

*Market orders never rest.* A market order that cannot be filled completely is
rejected with HTTP 400 rather than being partially filled and left pending. Only
limit orders reach `PENDING`.

### 10.2 Escrow — reserving capital without an escrow column

The design decision worth defending: **there is no `escrow` column anywhere**.
The held amount is implied by the resting order.

| | Held at placement | Recoverable as | Released by |
|---|---|---|---|
| **Buy** | Wallet debited `executed_cost + remaining × limit_price` | `remaining_quantity × limit_price` | Cancel, expiry, or fill |
| **Sell** | Portfolio decremented by the **full** order quantity | `remaining_quantity` shares | Cancel, expiry (fill pays cash instead) |

The invariant: **every reversal must recompute the held amount by the same
formula**. Three separate code paths perform reversals — `controller/cancel.py`,
`service/expiration.py`, and `service/matcher.py` — and if any one computed it
differently, balances would drift. `tests/test_escrow.py` exists specifically to
pin this.

The matcher additionally handles **over-hold refund**: escrow is always taken at
the worst-case limit price, but a fill may execute cheaper, so the difference
`filled × limit_price − actual_cost` is returned to the wallet at fill time.

*Trade-off to discuss honestly:* a dedicated `escrow_balance` column would be
more explicit and easier to audit. The implicit approach was chosen because it
makes double-spending structurally impossible — the money is simply not in the
wallet — but it means escrow can only be reconstructed from the order, which is
why the reversal formula must be duplicated consistently. This is a legitimate
"what I would do differently" answer.

### 10.3 Concurrency control — the double-release race

**The hazard.** The matcher runs every 10 seconds. A user may press *Cancel* at
the exact moment the matcher is filling that same order. Without protection,
both paths could release the same escrow, crediting the user twice — money
created from nothing.

**The mitigation**, implemented in `service/matcher.py`:

1. The cycle first selects only candidate order **IDs** — the ORM objects are
   deliberately not held across the cycle.
2. Each order is then re-fetched with
   `SELECT … FOR UPDATE SKIP LOCKED`. `SKIP LOCKED` means that if a concurrent
   cancellation already holds the row, the matcher skips it this cycle and
   retries on the next tick, rather than blocking.
3. **Status is re-validated under the lock.** Between the initial scan and
   acquiring the lock, a cancel may have committed, so the order is re-checked as
   still `PENDING` before any money moves. Acting on the status read during the
   scan would be acting on stale data.
4. If nothing is filled, the transaction is rolled back immediately to release
   the lock, so a waiting cancel is not blocked by an order the matcher will not
   touch.

**A second, subtler rule:** *never resolve market depth while holding a row lock.*
Depth resolution can make an HTTP call to the bridge, and holding a database row
lock across a network timeout would block every concurrent cancellation for the
duration. Therefore `buy.py` and `sell.py` resolve depth **before** opening their
transaction, and the matcher pre-resolves every book it needs at the top of the
cycle — one lookup per (symbol, side), reused for all orders. This is a strong
point in a viva: it shows awareness that lock *duration*, not just lock
*presence*, determines system behaviour under load.

### 10.4 Order book depth resolution — a four-step fallback chain

**The problem discovered during development.** The bridge's `/live-market`
payload contains prices but **no order book** — verified empirically: 0 of ~349
entries carried a `marketDepth` key. The engine originally looked for depth
there, always found nothing, and silently fell through to a synthetic ladder, so
*every* fill was simulated even while NEPSE was actively trading. Real books are
available only from the per-symbol `/depth/:symbol` endpoint, which nothing was
calling. This is a genuine debugging narrative and belongs in the report.

**The resolution chain** (`service/depth.py`), a single entry point
`resolve_levels(symbol, side, reference_price) → (levels, source)`:

| Step | Source | Label | Rationale |
|---|---|---|---|
| 1 | Inline `marketDepth` on the cached market row | `live` | Free; correct if a future bridge build ships books with `/live-market` |
| 2 | Live `GET /depth/:symbol` | `live` | The real order book; snapshotted on success |
| 3 | Stored snapshot `depth:<SYMBOL>` | `snapshot` | A closed market or downed bridge still fills against real prices |
| 4 | Synthetic ladder around the last traded price | `simulated` | Last resort so the platform is always usable |

**Two correctness guards, both essential:**

- **Stale books are band-limited.** Snapshot levels are trusted only inside the
  ±10% circuit band around the *current* price. Without this, filling a market
  buy against a stale Rs 200 ask when the stock now trades at Rs 260 would hand
  the user free money. Levels outside the band are discarded; if a side empties
  entirely, the system simulates instead.
- **Levels are sorted best-first before the walk.** The original code consumed
  the book in source order, which is only safe if the upstream feed happens to be
  pre-sorted — not something to bet execution prices on.

**Caching.** Resolved books are held in RAM per symbol with a source-dependent
TTL — 20 s while trading, 300 s when closed, 60 s after a failed lookup — so a
matcher cycle plus a burst of user orders does not produce one bridge call each.
Concurrent bridge calls are bounded by an 8-permit semaphore. Snapshot reads and
writes use their own short-lived database session so they can never interfere
with the caller's trading transaction.

The resolved source is returned in the API response as `depth_source` and
recorded in the transaction description — so every historical fill states which
data produced it. That is a real auditability feature; point it out.

### 10.5 Offline resilience and staleness labelling

NEPSE trades roughly 20 hours per week. For the other ~148, the live feed returns
nothing. Without a fallback the ticker, index chart, and landing page are blank
most of the time — which is what a demonstration to an examiner would show.

The mechanism: every successful bridge payload is upserted into
`market_snapshots` as raw JSONB. The market routes serve the stored copy when the
live call returns empty, adding **`is_stale: true`** and **`as_of: <ISO
timestamp>`** to the response. The frontend renders this through a shared
`StaleBadge` component in the navbar, the index chart, and the landing page.

**The critical detail:** `is_open` is *recomputed from the clock* rather than
replayed from the snapshot. A stored payload captured at 14:00 contains
`"OPEN"`; replaying it at 20:00 would falsely claim the market is trading. The
system therefore recomputes market status from `is_market_open_now()` (Sunday–
Thursday, 11:00–15:00 NPT) whenever serving a snapshot. **Stale prices are never
presented as live** — state this as an explicit design principle.

---

## 11. Module-by-Module Implementation

### 11.1 Authentication and user management

Registration hashes the password with bcrypt and creates the `Wallet`
(Rs 100,000) in the same transaction. Login uses OAuth2's
`OAuth2PasswordRequestForm`, where the `username` form field carries the email.
The JWT carries `user_id`, `email`, and `exp`; there is no refresh token.
`get_current_user` decodes the token and looks the user up **by the email claim**,
returning 401 for a bad token and 403 for a soft-deleted (`is_active = false`)
account. `get_current_admin` wraps it and rejects any non-admin; the entire admin
router is gated router-wide by that one dependency rather than per endpoint.
Profile updates, password change, and avatar upload (served as static files from
`/uploads`) complete the module.

### 11.2 Password reset by email OTP

A three-step flow: `POST /auth/forgot-password` generates an OTP, stores only its
**hash** in `password_reset_otps`, and emails the code; `POST /auth/verify-otp`
checks it; `POST /auth/reset-password` sets the new password. Attempts are capped
by `OTP_MAX_ATTEMPTS` and codes expire after `OTP_EXPIRY_MINUTES`. Development
uses Mailtrap's sandbox, so mail never reaches a real inbox.

*Implementation detail worth a sentence in the report:* these handlers are
deliberately synchronous `def` rather than `async def`. FastAPI runs sync handlers
in a threadpool, so the blocking `smtplib` call does not stall the event loop —
which matters here because the four background services share that loop. An
`async def` handler making a blocking SMTP call would freeze the matcher.

### 11.3 Trading

Three endpoints — `POST /trade/buy`, `POST /trade/sell`, `POST /trade/cancel/{id}`
— delegating to `controller/buy.py`, `sell.py`, and `cancel.py`. The algorithms
are §10.1–10.3. Note the deliberate lock ordering in `sell.py`: depth is resolved
*before* the portfolio row lock is taken.

### 11.4 Portfolio, watchlist, history

Portfolio rows are unique per (user, stock); a repeat purchase updates the
weighted-average cost:
`new_avg = (old_qty × old_avg + executed_cost) / (old_qty + filled_qty)`.
A holding reduced to zero is deleted rather than left as a zero row. Watchlist is
a simple unique (user, stock) join table. History reads the `transactions` audit
log.

### 11.5 Price alerts

`POST /alerts` stores `{stock, condition: ABOVE|BELOW, target_price, status:
ACTIVE}`. The controller **rejects a target already satisfied at creation time**,
so an alert can never trip instantly on creation. The checker loop compares
`Stock.last_traded_price` against the target every 60 s, locking each row with
`FOR UPDATE SKIP LOCKED` and re-checking status under the lock so a concurrent
delete cannot race.

**⚠ Honesty note — describe the notification mechanism accurately.** There is
**no WebSocket and no push notification**. The frontend polls `GET /alerts` every
60 s while the bell or toast component is mounted, and the poll is ref-counted so
only one interval runs regardless of how many components are mounted.
Acknowledgement is stored **client-side** in `localStorage` under
`alerts:seen:<email>` — the `Alert` model has no read/acknowledged column.
Furthermore, because the price column itself only refreshes every 300 s, the
worst-case end-to-end notification latency is approximately **six minutes, not
60 seconds**. Reporting this honestly, with the reasoning, is far stronger than
claiming real-time alerts.

### 11.6 Simulated banking and the admin approval workflow

A second money flow exists beside trading escrow. Every user has a simulated
e-bank account (Rs 100,000) sitting *beside* the trading wallet, with two
admin-approved queues between them:

- **Top-up:** `POST /users/me/bank/load` moves e-bank → wallet immediately. When
  the e-bank is exhausted, `POST /users/me/bank/request` files a `FundRequest`
  for admin approval.
- **Withdrawal:** `POST /users/me/wallet/withdraw` files a `WithdrawalRequest` in
  `PENDING`. **The wallet is debited only on admin approval**, never at request
  time — otherwise a rejected request would have to be compensated, and a crash
  between debit and rejection would lose the money.

### 11.7 Frontend

A React 19 SPA with route-based navigation (not tab state). State lives in eight
Zustand stores, one per domain. A single configured Axios instance carries two
interceptors: a request interceptor attaching the bearer token from
`localStorage`, and a response interceptor that force-logs-out on any 401 —
except on `/auth/login` and `/auth/register`, so credential errors surface
in-form instead of redirecting.

Two route guards: `ProtectedRoute` (requires authentication; **admins are
redirected to `/admin`** and cannot use the trading workspace) and `AdminRoute`
(requires `role === 'admin'`). Both `Dashboard` and `AdminDashboard` additionally
run a 10-second interval that logs the user out on local token expiry,
independent of API traffic — so an idle tab does not sit on a dead session.

Design language: slate base, **emerald for gains and rose for losses**,
`rounded-xl` surfaces, `tabular-nums` for all figures, Rs. currency formatting,
and Nepali compact units in the ticker (Ar = 10⁹, Cr = 10⁷).

---

## 12. API Reference

44 mounted endpoints across 9 routers, plus `GET /health`. Interactive OpenAPI
documentation is generated automatically at `http://localhost:8000/docs` —
screenshot it for the report appendix.

### Authentication — `/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account; auto-creates wallet at Rs 100,000 |
| POST | `/auth/login` | OAuth2 form login → JWT |
| POST | `/auth/forgot-password` | Generate and email OTP |
| POST | `/auth/verify-otp` | Verify OTP |
| POST | `/auth/reset-password` | Set new password |

### Trading — `/trade`
| Method | Path | Description |
|---|---|---|
| POST | `/trade/buy` | Place market or limit buy |
| POST | `/trade/sell` | Place market or limit sell |
| POST | `/trade/cancel/{order_id}` | Cancel a pending order, releasing escrow |

### User, wallet, and banking — `/users`
| Method | Path | Description |
|---|---|---|
| GET / PATCH | `/users/me` | Read / update profile |
| PUT | `/users/me/password` | Change password |
| POST | `/users/me/avatar` | Upload avatar (multipart) |
| GET | `/users/me/wallet` | Wallet balance |
| GET | `/users/me/portfolio` | Holdings with live valuation |
| GET | `/users/me/transactions` | Audit log |
| GET | `/users/orders` | Order history |
| GET | `/users/me/bank` | E-bank balance |
| POST | `/users/me/bank/load` | E-bank → wallet (immediate) |
| POST | `/users/me/bank/request` | File a top-up request |
| GET | `/users/me/bank/requests` | Own top-up requests |
| POST | `/users/me/wallet/withdraw` | File a withdrawal request |
| GET | `/users/me/withdrawals` | Own withdrawal requests |

### Market data — `/stocks`, `/market`, `/public`
| Method | Path | Description |
|---|---|---|
| GET | `/stocks` | All tracked securities |
| GET | `/stocks/{symbol}` | Single security detail |
| GET | `/market/summary` | Turnover / traded shares; snapshot fallback |
| GET | `/market/nepse-index` | Index series; snapshot fallback |
| GET | `/public/overview` | Unauthenticated landing-page overview |

### Watchlist and alerts
| Method | Path | Description |
|---|---|---|
| GET / POST | `/watchlist` | List / add |
| DELETE | `/watchlist/{symbol}` | Remove |
| GET / POST | `/alerts` | List / create (rejects already-met targets) |
| DELETE | `/alerts/{alert_id}` | Delete |

### Administration — `/admin` (entire router gated by `get_current_admin`)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/overview` | Platform statistics |
| GET | `/admin/users` | All users |
| DELETE | `/admin/users/{id}` | Disable (soft delete) |
| POST | `/admin/users/{id}/activate` | Re-enable |
| GET | `/admin/withdrawals` | Queue, optional `status_filter` |
| POST | `/admin/withdrawals/{id}/approve` | Approve — **debits the wallet here** |
| POST | `/admin/withdrawals/{id}/reject` | Reject with note |
| GET | `/admin/fund-requests` | Queue, optional `status_filter` |
| POST | `/admin/fund-requests/{id}/approve` | Approve and credit e-bank |
| POST | `/admin/fund-requests/{id}/reject` | Reject with note |

---

## 13. Security Implementation

| Concern | Mitigation |
|---|---|
| Password storage | bcrypt hashing via passlib; plaintext never stored or logged |
| Session management | JWT bearer tokens signed with `SECRET_KEY`; expiry via `ACCESS_TOKEN_EXPIRES_MINUTES` |
| Authorisation | `get_current_user` on every protected route; `get_current_admin` gates the whole admin router |
| Account disablement | `is_active` soft-delete → 403 on authentication, audit trail preserved |
| SQL injection | SQLAlchemy ORM with parameterised queries throughout |
| Input validation | Pydantic v2 schemas; `quantity > 0`, `limit_price > 0` enforced at the schema boundary |
| Cross-origin access | CORS restricted to the Vite dev origins, not `*` |
| OTP security | Only the **hash** is stored; capped attempts; time-bounded expiry |
| Financial integrity | DB `CHECK` constraints as a backstop to application validation |
| Race conditions | Row-level locking with re-validation under the lock |
| Secret management | `.env` gitignored; no credentials in source |

**⚠ Honesty note — weaknesses to acknowledge rather than hide:** there is no
refresh-token rotation; the JWT lives in `localStorage` and is therefore
XSS-reachable (an httpOnly cookie would be stronger); there is no rate limiting
on login or order placement; and CSRF is not applicable only because auth is
header-based rather than cookie-based. Listing these correctly demonstrates
security literacy — an examiner will find them regardless.

---

## 14. Testing

### 14.1 Strategy

Automated **integration** tests at the backend, driving the real FastAPI
application through Starlette's `TestClient`, plus manual/exploratory testing of
the UI. Integration rather than unit tests was chosen deliberately: the bugs that
matter in this system are in the interaction between the controller, the
database transaction, the row lock, and the depth resolver — a unit test with all
of those mocked would pass while the money still drifted.

### 14.2 Verified results (executed 2026-07-26)

```
platform darwin -- Python 3.14.6, pytest-9.1.1, pluggy-1.6.0
configfile: pytest.ini, testpaths: tests
collected 16 items

tests/test_depth.py    .............   [ 81%]
tests/test_escrow.py   ...             [100%]

============ 16 passed, 1 warning in 4.41s ============
```

**16 of 16 passed in 4.41 seconds.** Screenshot this terminal output for the
report.

### 14.3 Test inventory

`tests/test_escrow.py` — escrow round-trip and NEPSE price rules:

| # | Test | Verifies |
|---|---|---|
| 1 | `test_limit_buy_escrows_then_cancel_refunds_exactly` | Cancellation refunds the held amount **exactly** — no drift |
| 2 | `test_limit_buy_rejects_when_below_circuit_floor` | ±10% circuit filter rejects an out-of-band price |
| 3 | `test_limit_buy_rejects_bad_tick_size` | Rs 0.10 tick size enforced |

`tests/test_depth.py` — order book resolution and the fills produced from it:

| # | Test | Verifies |
|---|---|---|
| 1 | `test_live_depth_is_used_and_beats_the_simulated_ladder` | Real book preferred over the synthetic fallback |
| 2 | `test_asks_sort_cheapest_first_and_bids_highest_first` | Best-first ordering before the walk |
| 3 | `test_junk_levels_are_dropped` | Zero/negative/malformed levels filtered out |
| 4 | `test_inline_depth_on_the_market_item_wins_without_a_bridge_call` | Chain step 1 short-circuits the HTTP call |
| 5 | `test_book_is_cached_so_a_burst_of_orders_hits_the_bridge_once` | RAM cache prevents call amplification |
| 6 | `test_snapshot_serves_the_book_when_the_bridge_is_empty` | Chain step 3 — offline resilience |
| 7 | `test_stale_levels_outside_the_circuit_band_are_refused` | **Band-limiting guard** — the free-money defence |
| 8 | `test_snapshot_levels_inside_the_band_are_still_used` | The guard is not over-restrictive |
| 9 | `test_falls_back_to_the_simulated_ladder_with_nothing_else_available` | Chain step 4 — always usable |
| 10 | `test_order_walks_real_levels_in_price_order` | Multi-level walk / partial fill |
| 11 | `test_market_order_is_rejected_when_the_real_book_is_too_thin` | Market orders never rest |
| 12 | `test_matcher_fills_a_resting_order_when_the_real_book_reaches_it` | End-to-end background matching |
| 13 | `test_one_sided_book_simulates_only_the_missing_side` | Partial-book handling |

### 14.4 Test design note

Fixtures in `tests/conftest.py` create uniquely named throwaway users and stocks
and delete their rows on teardown, so a test run cannot collide with or pollute
real accounts. The `test_stock` fixture additionally removes its symbol from the
in-memory market cache, forcing the simulated-depth path (asks at 101–105 for a
Rs 100 stock) so that assertions are deterministic and independent of whether
NEPSE is open.

**⚠ Honesty note:** these tests run against the **`DATABASE_URL` database from
`.env`** — there is no separate test database. Disclose this as a limitation.

### 14.5 Manual test cases to tabulate

Build a table with columns *ID / Module / Precondition / Steps / Expected /
Actual / Pass-Fail*. Cover at minimum: registration and duplicate-email
rejection; login with wrong password; the full OTP reset flow; market buy with
insufficient balance; limit buy below the best ask (rests); limit buy above the
best ask (fills immediately at the ask — cite the NABIL example in §10.1);
cancellation refunding escrow exactly; day-order expiry (set
`ORDER_EXPIRY_MINUTES=2` to demonstrate this live); sell with insufficient
holdings; withdrawal request and admin approval debiting the wallet; fund request
and admin approval; alert creation with an already-met target (rejected); a
non-admin attempting `/admin` (403); and behaviour with the bridge stopped
(stale badge appears, prices still render).

---

## 15. Results & Project Metrics

### 15.1 Code metrics (verified 2026-07-26)

| Component | Lines | Detail |
|---|---|---|
| Backend (Python) | 5,704 | `app/`, `tests/`, `scripts/`, `alembic/` |
| Frontend (JSX/JS/CSS) | 8,086 | `src/` |
| Bridge (TypeScript) | 142 | Single-file Bun server |
| **Total** | **≈ 13,932** | |

| Metric | Value |
|---|---|
| Git commits | 43 |
| Development span | 2026-05-27 → 2026-07-24 |
| Database tables | 14 (+ `alembic_version`) |
| Alembic migrations | 7 |
| API endpoints | 44 (+ `/health`) |
| SQLAlchemy models | 13 |
| Background services | 4 |
| Zustand stores | 8 |
| React route screens | 11 workspace + 4 admin + 4 public |
| Automated tests | 16, all passing |
| Securities tracked | 388 |

### 15.2 Production build

`npm run build` produces `index.js` at **877 KB** and `index.css` at **43.7 KB**.

**⚠ Honesty note:** 877 KB is large for a SPA, and the cause is known and
specific — Recharts (~780 KB) is imported directly by two screens and is not
lazy-loaded. Naming the cause and the fix (route-level code splitting via
`React.lazy`) turns a weakness into evidence of engineering judgement. See §17.

### 15.3 Functional achievement against objectives

| Objective (§4.2) | Status | Evidence |
|---|---|---|
| 1. Live NEPSE data integration | Achieved | Bridge service; 388 stocks synchronised |
| 2. Matching engine with partial fills | Achieved | §10.1; tests 10–11 |
| 3. Escrow with exact release | Achieved | §10.2; escrow test 1 |
| 4. Circuit filter and tick size | Achieved | Escrow tests 2–3 |
| 5. Four background services | Achieved | §8.4 |
| 6. Offline resilience with staleness labelling | Achieved | §10.5; depth tests 6–9 |
| 7. JWT auth, RBAC, OTP reset, admin approval | Achieved | §11.1, §11.2, §11.6 |
| 8. Automated validation | Achieved | 16/16 passing |

---

## 16. Known Limitations (state these honestly)

An examiner will probe for weaknesses. Presenting them first, with the reasoning
and the fix, is consistently better received than being caught.

### 16.1 Monetary precision, and a live schema drift

Money columns are declared `NUMERIC(12,2)` in the SQLAlchemy models, but the
buy, sell, cancel, matcher, and expiry paths still `float()`-cast before writing
back to `wallet.balance`, so floating-point rounding is not fully eliminated.

Related and more serious: **the live `wallet.balance` column is actually
`double precision`, not `NUMERIC(12,2)`** — verified by inspecting the running
database on 2026-07-26. `bank_accounts.balance` is correctly `NUMERIC(12,2)`. The
cause is the schema-evolution policy in §9.6: `create_all()` created the wallet
table under an earlier model definition and **never ALTERs an existing table**,
so a later change of the model's column type was never applied to the database
and no migration was written for it.

This is worth a full paragraph in the report because it is a *real* defect found
by inspection, it has a precise cause, and the fix is a one-line Alembic
migration (`ALTER TABLE wallet ALTER COLUMN balance TYPE NUMERIC(12,2)`)
followed by replacing the `float()` casts with `Decimal` arithmetic. Finding and
diagnosing it is a stronger result than not having had it.

### 16.2 Other limitations

| # | Limitation | Impact | Fix |
|---|---|---|---|
| 2 | No WebSocket; alerts and market data are polled | Alert latency up to ~6 min (§11.5) | WebSocket or SSE push |
| 3 | Market sync interval hardcoded at 300 s | Prices lag intraday | Move to `Settings`; shorten during market hours |
| 4 | Tests run against the development database | Risk of pollution; no CI isolation | Dedicated test database + transactional fixtures |
| 5 | Test-created depth snapshots are not cleaned up | 13 of 18 `market_snapshots` rows are `depth:TST…` residue, and the count grew by 3 during a single test run on 2026-07-26 | Extend `conftest.py` teardown |
| 6 | Circuit filter and tick validation duplicated verbatim in `buy.py` and `sell.py` | Divergence risk on edit | Extract a shared validator |
| 7 | Frontend has no automated tests | Regressions caught only manually | Vitest + React Testing Library |
| 8 | Backend origin hardcoded as `http://localhost:8000` | Cannot deploy without an edit | Vite environment variable |
| 9 | Recharts not lazy-loaded | 877 KB bundle | `React.lazy` on chart routes |
| 10 | No brokerage commission, SEBON fee, DP charge, or CGT | P&L is gross, not net | Fee schedule at execution |
| 11 | NEPSE holidays not modelled | Market shown open on a holiday | Holiday calendar table |
| 12 | `useOrderStore` and `useTradeStore` both call `/trade/buy` and `/trade/sell` | Duplicated logic, divergence risk | Merge into one store |
| 13 | Alert acknowledgement stored in `localStorage` | Does not follow the user across devices | `acknowledged` column + migration |
| 14 | Users cannot fill one another's orders | Not a true multi-party exchange | Internal crossing book |
| 15 | `@app.on_event("startup")` is deprecated in current FastAPI | Warning; future breakage | Migrate to the `lifespan` handler |
| 16 | Depth may be served from a snapshot days old | Fills use a stale ladder (band-limited, so bounded) | Documented trade-off; surface the age in the UI |
| 17 | Single-server deployment; background loops are in-process | No horizontal scaling — two instances would double-run the matcher | Externalise to Celery/APScheduler with a lock |

---

## 17. Future Enhancements

1. **Real-time push** — replace polling with WebSockets for prices, order status,
   and alerts, removing the ~6-minute alert latency.
2. **Full `Decimal` money pipeline** — migrate `wallet.balance` to
   `NUMERIC(12,2)` and eliminate every `float()` cast (§16.1).
3. **Fee and tax modelling** — brokerage commission, SEBON fee, DP charge, and
   capital gains tax so simulated P&L matches a real trade.
4. **Internal order crossing** — a shared internal book so PaperTrade users fill
   one another's orders, introducing genuine price–time priority.
5. **Leaderboard and competitions** — ranked returns over a fixed window;
   time-boxed trading contests for classroom use.
6. **Portfolio analytics** — realised vs. unrealised P&L, XIRR, sector
   allocation, drawdown, Sharpe ratio.
7. **Technical charting** — candlesticks with SMA/EMA/RSI/MACD on the existing
   `lightweight-charts` dependency.
8. **Additional order types** — stop-loss, stop-limit, and good-till-cancelled.
9. **Mobile application** — React Native client against the same API.
10. **Containerised deployment** — Docker Compose for all three services plus
    PostgreSQL, with CI running the test suite on every push.
11. **Guided learning mode** — contextual explanations of circuit filters,
    partial fills, and marketable limit orders shown at the moment they occur.

---

## 18. Diagrams You Need to Draw

Most departments weight diagrams heavily. Priority order:

| Priority | Diagram | Content source |
|---|---|---|
| 1 | **System architecture** | §8.1 — three services, ports, arrow directions, PostgreSQL |
| 2 | **ER diagram** | §9.2, §9.4 — 14 tables, PK/FK, cardinalities, UNIQUE constraints |
| 3 | **Use case diagram** | Actors: Guest, User, Admin, and **System** (the four background services — include this, it is unusual and shows the autonomous behaviour) |
| 4 | **Order matching flowchart** | §10.1 pseudocode |
| 5 | **Order state transition diagram** | `PENDING → COMPLETED / CANCELLED / EXPIRED`, annotated with which component causes each transition |
| 6 | **Sequence diagram: limit buy** | User → React → API → controller → depth resolver → bridge → DB, showing escrow debit and the PENDING result |
| 7 | **Sequence diagram: matcher vs. concurrent cancel** | §10.3 — the row lock, `SKIP LOCKED`, and re-validation under lock. **This is your strongest technical diagram** |
| 8 | **Depth resolution chain flowchart** | §10.4 — four steps with the band-limit guard as a decision node |
| 9 | **DFD level 0 and level 1** | Context diagram, then decompose into auth, trading, market data, banking, admin |
| 10 | **Deployment diagram** | §8.1 with ports and process boundaries |

---

## 19. Suggested Report Chapter Structure

| Chapter | Contents | Source sections |
|---|---|---|
| Front matter | Title, certificate, declaration, acknowledgement, abstract, ToC, list of figures/tables, abbreviations | §1, §2 |
| 1. Introduction | Background, problem statement, objectives, scope and limitations, report organisation | §3, §4, §5 |
| 2. Literature Review | Order types, matching theory, NEPSE microstructure, existing systems comparison, technology review | §6 |
| 3. Methodology / Requirement Analysis | Development model, functional and non-functional requirements, feasibility, tools | §7, §12 |
| 4. System Design | Architecture, database design, ER diagram, DFD, use case, sequence diagrams, UI design | §8, §9, §18 |
| 5. Implementation | Algorithms, module-by-module implementation, code excerpts | §10, §11 |
| 6. Testing | Strategy, automated results, test inventory, manual test case table | §14 |
| 7. Results and Discussion | Screenshots, metrics, objectives achieved, limitations discussion | §15, §16 |
| 8. Conclusion and Future Work | Summary of contribution, learning outcomes, future enhancements | §17 |
| References | IEEE or APA per department standard | §20 |
| Appendices | Selected source listings, full API documentation screenshot from `/docs`, database schema dump, user manual | §12 |

### Screenshots to capture

Landing page (with the stale badge visible); registration and login; dashboard
home with the index chart; market screen; **the order placement form**; **the
orders screen showing one PENDING and one COMPLETED order side by side** —
this single screenshot demonstrates the entire matching engine; portfolio with
weighted average price; transaction history showing an `ESCROW_HOLD` next to its
matching `ESCROW_RELEASE`; wallet and e-bank; alerts with a triggered toast; the
admin overview; both admin approval queues; the Swagger UI at `/docs`; and the
passing pytest output.

### Viva questions to prepare for

1. *Why does a limit buy sometimes execute immediately?* — §10.1, with the NABIL
   worked example. Practise this one; it is the most likely question.
2. *How do you prevent double-spending across two resting orders?* — escrow debits
   the wallet at placement, so the cash is not there to spend twice (§10.2).
3. *What happens if a user cancels at the exact moment the matcher fills?* —
   §10.3, row lock plus re-validation under the lock.
4. *Why not just fill every order at the last traded price?* — no partial fills,
   no weighted average price, no realistic slippage; the simulation would teach
   the wrong mental model.
5. *What happens when the market is closed?* — §10.5, snapshot fallback with
   explicit staleness labelling and clock-recomputed `is_open`.
6. *Why three separate services instead of one?* — §8.2, language-boundary
   adapter isolating an unofficial upstream dependency.
7. *Is your money arithmetic exact?* — Answer honestly: §16.1. Explain the
   `NUMERIC`/`float` mismatch, that you found it, and the exact fix.
8. *Where is the escrow column?* — There isn't one; explain the implicit design
   and its trade-off (§10.2).

---

## 20. References

Compile in your department's required style. Sources to include:

**Domain**
1. Nepal Stock Exchange Ltd. — trading regulations, circuit filter, and market
   hours. `https://www.nepalstock.com`
2. Securities Board of Nepal (SEBON) — regulatory framework.
3. Harris, L. (2003). *Trading and Exchanges: Market Microstructure for
   Practitioners*. Oxford University Press. — the standard reference for order
   types, the limit order book, and price–time priority.
4. Hasbrouck, J. (2007). *Empirical Market Microstructure*. Oxford University
   Press.

**Technical**
5. FastAPI documentation — `https://fastapi.tiangolo.com`
6. SQLAlchemy 2.0 documentation — `https://docs.sqlalchemy.org`
7. PostgreSQL documentation, Ch. 13 *Concurrency Control* — the authoritative
   source for `SELECT … FOR UPDATE` and `SKIP LOCKED`; cite this for §10.3.
8. React documentation — `https://react.dev`
9. Zustand — `https://github.com/pmndrs/zustand`
10. Bun documentation — `https://bun.sh/docs`
11. Tailwind CSS — `https://tailwindcss.com`
12. `nepse-api-unofficial` npm package.
13. RFC 7519 — JSON Web Token (JWT).
14. Provos, N., & Mazières, D. (1999). *A Future-Adaptable Password Scheme*.
    USENIX. — the bcrypt paper.

---

*Document generated 2026-07-26 from the PaperTrade codebase at commit `a3981e9`.
All metrics, test results, schema details, and the worked NABIL example were
verified against the running system, not estimated.*
