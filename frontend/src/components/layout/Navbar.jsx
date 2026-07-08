// components/layout/Navbar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

// Human-readable title per route, shown in the top bar for context.
const PAGE_TITLES = {
  '/': 'Dashboard',
  '/portfolio': 'Portfolio',
  '/orders': 'Order Book',
  '/charts': 'Charts',
  '/market': 'Market',
  '/watchlist': 'Watchlist',
  '/history': 'History',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
};

// NEPSE trades Sunday–Thursday, 11:00–15:00 Nepal time (UTC+05:45).
// Computed from the real clock rather than a hard-coded flag.
const getNepseStatus = () => {
  const now = new Date();
  const nptMs = now.getTime() + now.getTimezoneOffset() * 60000 + (5 * 60 + 45) * 60000;
  const npt = new Date(nptMs);
  const day = npt.getDay(); // 0 = Sun … 6 = Sat
  const minutes = npt.getHours() * 60 + npt.getMinutes();

  const isTradingDay = day >= 0 && day <= 4; // Sun–Thu
  const isOpen = isTradingDay && minutes >= 11 * 60 && minutes < 15 * 60;

  return { isOpen, isTradingDay };
};

const formatToday = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

const Navbar = ({ backendUrl = '/api/market-summary' }) => {
  const location = useLocation();
  const balance = useAppStore((state) => state.portfolio.balance);
  const fetchWallet = useAppStore((state) => state.fetchWallet);

  // Real index data is only rendered when a market-summary endpoint actually
  // returns it — we never fabricate numbers as a fallback.
  const [indices, setIndices] = useState(null);
  const [status, setStatus] = useState(getNepseStatus);
  const [loading, setLoading] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(getNepseStatus());
    fetchWallet();
    try {
      const response = await fetch(backendUrl);
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      setIndices(data?.nepse ? data : null);
    } catch {
      setIndices(null); // stay honest: no live feed, no numbers
    } finally {
      setLoading(false);
    }
  }, [backendUrl, fetchWallet]);

  useEffect(() => {
    refresh();
    const dataTimer = setInterval(refresh, 30000);
    const clockTimer = setInterval(() => setStatus(getNepseStatus()), 60000);
    return () => {
      clearInterval(dataTimer);
      clearInterval(clockTimer);
    };
  }, [refresh]);

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between select-none z-10">
      {/* Left: page context */}
      <div className="flex flex-col leading-tight">
        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          {pageTitle}
        </h1>
        <span className="text-xs text-slate-400 font-medium">{formatToday()}</span>
      </div>

      {/* Center: live NEPSE index (only when a real feed is connected) */}
      {indices?.nepse && (
        <div className="hidden xl:flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            NEPSE
          </span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">
            {indices.nepse.value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
          <span
            className={`flex items-center text-xs font-semibold tabular-nums ${
              indices.nepse.change >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {indices.nepse.change >= 0 ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            {Math.abs(indices.nepse.percentChange).toFixed(2)}%
          </span>
        </div>
      )}

      {/* Right: status + actions + balance */}
      <div className="flex items-center gap-3">
        {/* Market status (computed from real NEPSE hours) */}
        <div
          className={`hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 border ${
            status.isOpen
              ? 'bg-emerald-50 border-emerald-100'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {status.isOpen && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </span>
          <span
            className={`text-[11px] font-bold tracking-wide ${
              status.isOpen ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {status.isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh"
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>

        <button
          title="Notifications"
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Bell size={18} />
        </button>

        {/* Paper balance */}
        <div className="flex flex-col items-end border-l border-slate-200 pl-3">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Buying Power
          </span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">
            Rs.{' '}
            {balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
