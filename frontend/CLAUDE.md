# CLAUDE.md — frontend

Service-specific guidance for the React SPA. See the repo-root `CLAUDE.md` for the big-picture, cross-service view. This file covers frontend internals that require reading several files to understand.

## Stack & commands

React 19 + Vite + Zustand + Axios + Tailwind 4, routing via `react-router-dom` v7. Run from this directory: `npm run dev` (`:5173`) | `npm run build` | `npm run lint` (**oxlint**, not ESLint) | `npm run preview`. Backend origin is hardcoded (no env var) — see API layer.

## API layer (`services/api.js`)

A single configured axios instance is the **default export `API`** (`baseURL: 'http://localhost:8000/'`). Use it for all backend calls.

- **Request interceptor** auto-attaches `Authorization: Bearer <token>` from `localStorage['token']` — so you normally **don't** set the header manually (some older store actions redundantly do; don't copy that).
- **Response interceptor**: on `401` calls `forceLogout()` (clears `token`+`user`, hard-redirects to `/login`), except for `/auth/login` & `/auth/register` so credential errors surface in-form.
- **Auth session lives in `localStorage`**: JWT under `'token'`, user object under `'user'`. No httpOnly cookies.
- Exported helpers: `API` (default), `API_ORIGIN`, `assetUrl(path)` (resolve backend-relative paths like avatars to absolute), `decodeToken`, `isTokenExpired`, `forceLogout`.

## State: Zustand stores (`store/`)

**One store per domain.** Common pattern: `create((set, get) => ({...}))`, import shared `API`, hold `isLoading`+`error`, derive error via `error.response?.data?.detail || error.message`, and **re-fetch the list after a mutation** to re-sync. **No `persist` middleware** — only `useAppStore` manually reads/writes localStorage for the session.

- **`useAppStore`** — the hub: auth + wallet + portfolio + market. Initializes session from localStorage at module load (discards expired tokens via `isTokenExpired`). Endpoints: `POST /auth/login` (URL-encoded for OAuth2), `POST /auth/register`, `GET/PATCH /users/me`, `PUT /users/me/password`, `POST /users/me/avatar` (multipart), `GET /users/me/wallet`, `POST /users/me/wallet/deposit`, `GET /users/me/portfolio`, `GET /stocks`.
- **`useOrderStore`** — `orders` list; `GET /users/orders`, `POST /trade/buy`, `POST /trade/sell`, `POST /trade/cancel/{id}`.
- **`useTradeStore`** — also `POST /trade/buy` / `/trade/sell` (⚠️ **overlaps `useOrderStore`** — two stores hit the same endpoints; `useTradeStore` additionally cross-calls `useAppStore.fetchWallet()`+`fetchPortfolio()` after success). Be aware which one a component uses.
- **`useWatchlistStore`** — `GET/POST /watchlist`, `DELETE /watchlist/{symbol}`.
- **`useHistoryStore`** — `GET /users/me/transactions`.
- **`useAlertsStore`** — `GET/POST /alerts`, `DELETE /alerts/{id}`.
- **`useAdminStore`** — uses `loading` (not `isLoading`). `GET /admin/overview`, `GET /admin/users`, `DELETE /admin/users/{id}` (disable), `POST /admin/users/{id}/activate`, `GET /admin/withdrawals` (optional `status_filter`), `POST /admin/withdrawals/{id}/approve|reject`.

## Routing & auth gating (`App.jsx`)

`main.jsx` is bare (`createRoot` → `<App/>`, no providers — Zustand needs none). All routing and **two inline route guards** live in `App.jsx`:

- **`ProtectedRoute`** — needs `isAuthenticated`; guests → `/login`; **admins are redirected to `/admin`** (they can't use the trading workspace).
- **`AdminRoute`** — needs `role === 'admin'`; non-admins → `/`, guests → `/login`.
- Public: `/welcome` (Landing), `/login`, `/register`. Trading: `/` (Dashboard shell) with nested children `portfolio, orders, charts, market, watchlist, history, wallet, alerts, settings`. Admin: `/admin` (AdminDashboard shell) with `users`, `withdrawals`. Catch-all → `/welcome`.
- **Navigation is route-based, not tab-state** — screens are separate route components rendered via `<Outlet/>`; the sidebar highlights the active one by `location.pathname === item.path`. There is no tab-index state anywhere.
- **Idle-session watcher**: both `Dashboard.jsx` and `AdminDashboard.jsx` run a `setInterval(check, 10000)` that logs out on `isTokenExpired`, independent of API traffic.

## Component organization

- **`components/layout/`** — `Navbar.jsx` (NEPSE index/turnover ticker strip; fetches directly via `API`) and `Sidebar.jsx` (nav items `{name, icon, path}`).
- **`components/dashboard/`** — the 10 workspace screens (DashboardHome, Portfolio, Orders, Market, Watchlist, History, Charts, Alerts, Wallet, Settings) + `MockChart.jsx`. Only `DashboardHome` and `Charts` import **recharts** (heavy; not lazy-loaded — lazy-load when extending these).
- **`components/admin/`** — `AdminSidebar`, `AdminOverview`, `AdminUsers`, `AdminWithdrawals`.
- **`components/ui/`, `hooks/`, `types/` are EMPTY** — there is **no shared UI kit, no custom hooks, no type defs**. Every screen is bespoke Tailwind markup.

## Conventions (be aware before adding UI)

- **No shared formatter.** Each component redefines its own local `fmtMoney`/`fmtPrice`/`fmtDateTime`/etc. (mostly `Number(n||0).toLocaleString(...)`). If you add a reusable formatter, that's a genuine improvement — currently it's all duplicated.
- **Currency symbol is inconsistent** (known): `रू` (Devanagari) in `pages/Register.jsx`, `pages/LandingPage.jsx`, and `components/dashboard/Portfolio.jsx`; `Rs.` most other places (Wallet, History, Orders, DashboardHome, Alerts, admin screens, Navbar). Prefer **`Rs.`** for new UI. Navbar also uses Nepali compact units (Arba `Ar` = 1e9, Crore `Cr` = 1e7).
- **Colors**: base chrome is `slate`; up/positive = **`emerald`**, down/negative = **`rose`** (Tailwind, applied inline). Icons from `lucide-react` (e.g. `ArrowUpRight`/`ArrowDownRight`).
- Note `components/TabContentPlaceholder.jsx` is a stray file referenced only in a commented-out route.
