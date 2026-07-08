// components/dashboard/Charts.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';

// Validated status palette (see dataviz validator: CVD ΔE 21.3, contrast passes).
const UP = '#059669'; // advancing / gainers
const DOWN = '#e11d48'; // declining / losers
const FLAT = '#64748b'; // unchanged
const VOL = '#3b82f6'; // single-hue magnitude (volume)

const GRID = '#f1f5f9'; // recessive grid (slate-100)
const AXIS = '#94a3b8'; // axis text (slate-400)

const fmtNum = (n) => Number(n || 0).toLocaleString();
const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Shared tooltip styling so every chart reads as one system
const TooltipBox = ({ children }) => (
  <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
    {children}
  </div>
);

const Charts = () => {
  const stocks = useAppStore((s) => s.marketTickers);
  const loading = useAppStore((s) => s.marketLoading);
  const fetchTickers = useAppStore((s) => s.fetchTickers);

  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchTickers();
  }, [fetchTickers]);

  // Close the search suggestions when clicking outside the box
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Default the day-range selector to the most active stock once data arrives
  useEffect(() => {
    if (!selected && stocks.length > 0) {
      const mostActive = [...stocks].sort(
        (a, b) => Number(b.volume) - Number(a.volume),
      )[0];
      if (mostActive) setSelected(mostActive.symbol);
    }
  }, [stocks, selected]);

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
    return [
      { name: 'Advancing', value: up, color: UP },
      { name: 'Declining', value: down, color: DOWN },
      { name: 'Unchanged', value: flat, color: FLAT },
    ];
  }, [stocks]);

  const totalStocks = stocks.length;

  const volumeData = useMemo(
    () =>
      [...stocks]
        .sort((a, b) => Number(b.volume) - Number(a.volume))
        .slice(0, 10)
        .map((s) => ({ symbol: s.symbol, volume: Number(s.volume || 0) })),
    [stocks],
  );

  // Diverging: top 5 gainers (green, +) and top 5 losers (red, −) by % change
  const moversData = useMemo(() => {
    const changed = stocks.filter((s) => Number(s.percent_change) !== 0);
    const sorted = [...changed].sort(
      (a, b) => Number(b.percent_change) - Number(a.percent_change),
    );
    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5);
    return [...gainers, ...losers.reverse()].map((s) => ({
      symbol: s.symbol,
      pct: Number(Number(s.percent_change).toFixed(2)),
    }));
  }, [stocks]);

  const selectedStock = useMemo(
    () => stocks.find((s) => s.symbol === selected) || null,
    [stocks, selected],
  );

  const searchResults = useMemo(() => {
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

  const handlePick = (symbol) => {
    setSelected(symbol);
    setQuery('');
    setShowResults(false);
  };

  const noData = !loading && stocks.length === 0;

  if (noData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Charts</h1>
          <p className="text-sm text-slate-500">Visual market analytics</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-20 text-center text-slate-500">
          <p className="text-sm font-medium">No market data available.</p>
          <p className="text-xs text-slate-400 mt-1">
            The live NEPSE feed may be offline. Charts will populate automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Charts</h1>
          <p className="text-sm text-slate-500">
            Visual market analytics across {totalStocks} listed stocks
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market breadth donut */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800">Market Breadth</h2>
          <p className="text-xs text-slate-400 mb-2">Advancing vs declining stocks</p>

          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={breadth}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={85}
                  paddingAngle={2}
                  stroke="none"
                >
                  {breadth.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <TooltipBox>
                        <span className="font-bold text-slate-800">
                          {payload[0].name}
                        </span>
                        <span className="text-slate-500">
                          {' '}
                          — {payload[0].value} stock
                          {payload[0].value !== 1 ? 's' : ''}
                        </span>
                      </TooltipBox>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800 tabular-nums">
                {totalStocks}
              </span>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Listed
              </span>
            </div>
          </div>

          {/* Legend with direct labels + icons (secondary encoding, never color-alone) */}
          <div className="mt-3 space-y-1.5">
            {breadth.map((b) => {
              const Icon =
                b.name === 'Advancing'
                  ? TrendingUp
                  : b.name === 'Declining'
                    ? TrendingDown
                    : Minus;
              return (
                <div
                  key={b.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: b.color }}
                    />
                    <Icon size={13} style={{ color: b.color }} />
                    {b.name}
                  </span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {b.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top movers diverging bar */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800">Top Movers</h2>
          <p className="text-xs text-slate-400 mb-4">
            Biggest gainers and losers by % change
          </p>

          {moversData.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No price changes to display yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={moversData}
                layout="vertical"
                margin={{ left: 8, right: 24 }}
              >
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis
                  type="number"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="symbol"
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <TooltipBox>
                        <span className="font-bold text-slate-800">
                          {payload[0].payload.symbol}
                        </span>
                        <span
                          className="font-semibold"
                          style={{ color: payload[0].value >= 0 ? UP : DOWN }}
                        >
                          {' '}
                          {payload[0].value >= 0 ? '+' : ''}
                          {payload[0].value}%
                        </span>
                      </TooltipBox>
                    ) : null
                  }
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                  {moversData.map((d) => (
                    <Cell key={d.symbol} fill={d.pct >= 0 ? UP : DOWN} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Most active by volume */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800">Most Active</h2>
          <p className="text-xs text-slate-400 mb-4">Top 10 stocks by traded volume</p>

          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={volumeData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis
                type="number"
                tick={{ fill: AXIS, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <YAxis
                type="category"
                dataKey="symbol"
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox>
                      <span className="font-bold text-slate-800">
                        {payload[0].payload.symbol}
                      </span>
                      <span className="text-slate-500">
                        {' '}
                        — {fmtNum(payload[0].value)} shares
                      </span>
                    </TooltipBox>
                  ) : null
                }
              />
              <Bar dataKey="volume" fill={VOL} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day range for a selected stock */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-slate-800">Day Range</h2>
          </div>
          <div className="relative mb-5" ref={searchRef}>
            <Search
              size={16}
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
              placeholder="Search a stock…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
            />

            {showResults && query.trim() && (
              <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((s) => (
                    <button
                      key={s.stock_id}
                      onClick={() => handlePick(s.symbol)}
                      className="w-full flex flex-col items-start px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-slate-800">
                        {s.symbol}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[240px]">
                        {s.company_name}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    No matches for “{query.trim().toUpperCase()}”.
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedStock &&
            (() => {
              const low = Number(selectedStock.low_price || 0);
              const high = Number(selectedStock.high_price || 0);
              const open = Number(selectedStock.open_price || 0);
              const ltp = Number(selectedStock.current_price || 0);
              const pct = Number(selectedStock.percent_change || 0);
              const up = pct >= 0;
              const range = high - low;
              const pos = range > 0 ? ((ltp - low) / range) * 100 : 50;
              const clamped = Math.min(100, Math.max(0, pos));

              return (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedStock.symbol}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {selectedStock.company_name}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-slate-800 tabular-nums">
                      {fmtPrice(ltp)}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: up ? UP : DOWN }}
                    >
                      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                    </span>
                  </div>

                  {/* Low → High track with LTP marker */}
                  <div>
                    <div className="relative h-2 rounded-full bg-slate-100">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                        style={{
                          left: `${clamped}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: up ? UP : DOWN,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs">
                      <span className="text-slate-400">
                        Low <span className="font-semibold text-slate-600">{fmtPrice(low)}</span>
                      </span>
                      <span className="text-slate-400">
                        High <span className="font-semibold text-slate-600">{fmtPrice(high)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        Open
                      </p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">
                        {fmtPrice(open)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        Volume
                      </p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">
                        {fmtNum(selectedStock.volume)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
};

export default Charts;
