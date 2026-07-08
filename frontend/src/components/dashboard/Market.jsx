// components/dashboard/Market.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import {
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from 'lucide-react';

const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtVolume = (n) => Number(n || 0).toLocaleString();

const fmtUpdated = (date) =>
  date
    ? date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

// A single market-breadth stat tile
const StatTile = ({ label, value, tone = 'slate', icon: Icon }) => {
  const tones = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
  };
  const iconTones = {
    slate: 'bg-slate-100 text-slate-500',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
      <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${iconTones[tone]}`}>
        <Icon size={18} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <span className={`text-lg font-bold tabular-nums ${tones[tone]}`}>{value}</span>
      </div>
    </div>
  );
};

// Sortable column header
const SortHeader = ({ label, sortKey, active, dir, onSort, align = 'left' }) => (
  <th className={`px-6 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
    <button
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider transition-colors ${
        active ? 'text-slate-700' : 'text-slate-400 hover:text-slate-600'
      } ${align === 'right' ? 'flex-row-reverse' : ''}`}
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} className="opacity-50" />
      )}
    </button>
  </th>
);

const Market = () => {
  const navigate = useNavigate();
  const stocks = useAppStore((state) => state.marketTickers);
  const loading = useAppStore((state) => state.marketLoading);
  const error = useAppStore((state) => state.marketError);
  const updatedAt = useAppStore((state) => state.marketUpdatedAt);
  const fetchTickers = useAppStore((state) => state.fetchTickers);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');

  // Initial load + poll every 30s to stay fresh
  useEffect(() => {
    fetchTickers();
    const interval = setInterval(fetchTickers, 30000);
    return () => clearInterval(interval);
  }, [fetchTickers]);

  // Market breadth summary
  const breadth = useMemo(() => {
    let up = 0;
    let down = 0;
    let flat = 0;
    for (const s of stocks) {
      const c = Number(s.percent_change || 0);
      if (c > 0) up += 1;
      else if (c < 0) down += 1;
      else flat += 1;
    }
    return { total: stocks.length, up, down, flat };
  }, [stocks]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Text sorts ascending by default, numbers descending
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const visibleStocks = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = q
      ? stocks.filter(
          (s) =>
            s.symbol?.toUpperCase().includes(q) ||
            s.company_name?.toUpperCase().includes(q),
        )
      : stocks;

    const sorted = [...filtered].sort((a, b) => {
      let av;
      let bv;
      switch (sortKey) {
        case 'symbol':
          av = a.symbol || '';
          bv = b.symbol || '';
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        case 'price':
          av = Number(a.current_price || 0);
          bv = Number(b.current_price || 0);
          break;
        case 'percent':
          av = Number(a.percent_change || 0);
          bv = Number(b.percent_change || 0);
          break;
        case 'volume':
        default:
          av = Number(a.volume || 0);
          bv = Number(b.volume || 0);
          break;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return sorted;
  }, [stocks, query, sortKey, sortDir]);

  const isInitialLoad = loading && stocks.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Market</h1>
          <p className="text-sm text-slate-500">
            Live NEPSE prices · Last updated {fmtUpdated(updatedAt)}
          </p>
        </div>
        <button
          onClick={fetchTickers}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Market breadth tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Listed" value={breadth.total} tone="slate" icon={BarChart3} />
        <StatTile label="Advancing" value={breadth.up} tone="emerald" icon={TrendingUp} />
        <StatTile label="Declining" value={breadth.down} tone="rose" icon={TrendingDown} />
        <StatTile label="Unchanged" value={breadth.flat} tone="slate" icon={Minus} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symbol or company…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isInitialLoad ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading live market data…</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
              <p className="text-xs text-slate-400 mt-1">
                Try refreshing in a moment.
              </p>
            </div>
          ) : stocks.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm font-medium">No market data available.</p>
              <p className="text-xs text-slate-400 mt-1">
                The live NEPSE feed may be offline. Data refreshes automatically.
              </p>
            </div>
          ) : visibleStocks.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm font-medium">No stocks match “{query}”.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs">
                  <SortHeader
                    label="Symbol"
                    sortKey="symbol"
                    active={sortKey === 'symbol'}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="LTP"
                    sortKey="price"
                    active={sortKey === 'price'}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="% Change"
                    sortKey="percent"
                    active={sortKey === 'percent'}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label="Volume"
                    sortKey="volume"
                    active={sortKey === 'volume'}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleStocks.map((stock) => {
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
                      <td className="px-6 py-3.5 text-right text-slate-600 tabular-nums">
                        {fmtVolume(stock.volume)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => navigate('/orders')}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Market;
