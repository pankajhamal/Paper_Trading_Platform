// components/dashboard/Watchlist.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistStore } from '../../store/useWatchlistStore';
import { useAppStore } from '../../store/useAppStore';
import {
  Search,
  Plus,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Watchlist = () => {
  const navigate = useNavigate();

  const items = useWatchlistStore((s) => s.items);
  const isLoading = useWatchlistStore((s) => s.isLoading);
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist);
  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);

  // The full stock universe powers the search suggestions.
  const stocks = useAppStore((s) => s.marketTickers);
  const fetchTickers = useAppStore((s) => s.fetchTickers);

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const toastTimer = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchWatchlist();
    fetchTickers();
  }, [fetchWatchlist, fetchTickers]);

  // Close the suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const notify = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const watchedSymbols = useMemo(
    () => new Set(items.map((i) => i.symbol)),
    [items],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return stocks
      .filter(
        (s) =>
          s.symbol?.toUpperCase().includes(q) ||
          s.company_name?.toUpperCase().includes(q),
      )
      .slice(0, 6);
  }, [stocks, query]);

  const handleAdd = async (symbol) => {
    const result = await addToWatchlist(symbol);
    if (result.success) {
      notify(`${symbol} added to watchlist.`, 'success');
      setQuery('');
      setShowResults(false);
    } else {
      notify(result.error, 'error');
    }
  };

  const handleRemove = async (symbol) => {
    const result = await removeFromWatchlist(symbol);
    if (result.success) {
      notify(`${symbol} removed from watchlist.`, 'success');
    } else {
      notify(result.error, 'error');
    }
  };

  // Enter adds the exact typed symbol directly (works even if suggestions are empty)
  const handleSubmit = (e) => {
    e.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (symbol) handleAdd(symbol);
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Watchlist</h1>
          <p className="text-sm text-slate-500">
            {items.length > 0
              ? `Tracking ${items.length} stock${items.length > 1 ? 's' : ''}`
              : 'Search and add stocks to follow their prices'}
          </p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="relative max-w-md" ref={searchRef}>
        <form onSubmit={handleSubmit}>
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search symbol or company to add…"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
          />
        </form>

        {/* Suggestions dropdown */}
        {showResults && query.trim() && (
          <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.length > 0 ? (
              suggestions.map((s) => {
                const already = watchedSymbols.has(s.symbol);
                return (
                  <button
                    key={s.stock_id}
                    onClick={() => !already && handleAdd(s.symbol)}
                    disabled={already}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors disabled:cursor-not-allowed"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-slate-800">
                        {s.symbol}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[240px]">
                        {s.company_name}
                      </span>
                    </div>
                    {already ? (
                      <span className="text-xs font-semibold text-emerald-600">
                        Added
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Plus size={13} /> Add
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400">
                No matches. Press Enter to try “{query.trim().toUpperCase()}”.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watchlist table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading your watchlist…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <Star size={22} />
              </div>
              <p className="text-sm font-medium">Your watchlist is empty.</p>
              <p className="text-xs text-slate-400 mt-1">
                Use the search above to start following stocks.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Symbol</th>
                  <th className="px-6 py-3 text-right">LTP</th>
                  <th className="px-6 py-3 text-right">% Change</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((stock) => {
                  const pct = Number(stock.percent_change || 0);
                  const isUp = pct > 0;
                  const isDown = pct < 0;
                  const changeColor = isUp
                    ? 'text-emerald-600'
                    : isDown
                      ? 'text-rose-600'
                      : 'text-slate-500';

                  return (
                    <tr key={stock.stock_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">
                            {stock.symbol}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[220px]">
                            {stock.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-700 tabular-nums">
                        {fmtPrice(stock.current_price)}
                      </td>
                      <td className={`px-6 py-3.5 text-right font-semibold tabular-nums ${changeColor}`}>
                        <span className="inline-flex items-center justify-end gap-0.5">
                          {isUp && <ArrowUp size={13} />}
                          {isDown && <ArrowDown size={13} />}
                          {Math.abs(pct).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate('/orders')}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                          >
                            Trade
                          </button>
                          <button
                            onClick={() => handleRemove(stock.symbol)}
                            title="Remove from watchlist"
                            className="inline-flex items-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 z-[10000] transition-all duration-500 ease-in-out transform ${
          toast
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        {toast && (
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;
