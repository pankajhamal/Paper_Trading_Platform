// components/dashboard/DashboardHome.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import API from '../../services/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Receipt,
  Plus,
  Activity,
  RefreshCw,
} from 'lucide-react';

const UP = '#059669';
const DOWN = '#e11d48';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtIndex = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const INFLOW_TYPES = new Set(['SELL', 'ESCROW_RELEASE', 'DEPOSIT', 'CREDIT', 'REFUND']);
const OUTFLOW_TYPES = new Set(['BUY', 'WITHDRAW', 'DEBIT']);

const DashboardHome = () => {
  const navigate = useNavigate();

  const fetchPortfolio = useAppStore((s) => s.fetchPortfolio);
  const fetchTickers = useAppStore((s) => s.fetchTickers);
  const fetchProfile = useAppStore((s) => s.fetchProfile);

  const user = useAppStore((s) => s.user);
  const holdings = useAppStore((s) => s.portfolio.holdings);
  const stocks = useAppStore((s) => s.marketTickers);

  const transactions = useHistoryStore((s) => s.transactions);
  const fetchTransactions = useHistoryStore((s) => s.fetchTransactions);

  // NEPSE index series (fetched from the backend, which proxies the nepse-bridge)
  const [nepse, setNepse] = useState(null);
  const [nepseLoading, setNepseLoading] = useState(false);

  const loadNepseIndex = useCallback(async () => {
    setNepseLoading(true);
    try {
      const response = await API.get('/market/nepse-index');
      setNepse(response.data);
    } catch {
      setNepse(null);
    } finally {
      setNepseLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchPortfolio();
    fetchTickers();
    fetchTransactions();
    loadNepseIndex();
  }, [fetchProfile, fetchPortfolio, fetchTickers, fetchTransactions, loadNepseIndex]);

  const firstName = (user?.name || user?.full_name || user?.email?.split('@')[0] || 'Trader')
    .split(' ')[0];

  const topHoldings = useMemo(
    () =>
      [...(holdings || [])]
        .sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
        .slice(0, 5),
    [holdings],
  );

  const { gainers, losers } = useMemo(() => {
    const withChange = stocks.filter((s) => Number(s.percent_change) !== 0);
    const sorted = [...withChange].sort(
      (a, b) => Number(b.percent_change) - Number(a.percent_change),
    );
    return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
  }, [stocks]);

  const recentActivity = useMemo(() => transactions.slice(0, 5), [transactions]);

  const nepsePoints = nepse?.points || [];
  const nepseChange = Number(nepse?.change || 0);
  const nepsePct = Number(nepse?.percent_change || 0);
  const nepseUp = nepseChange >= 0;
  const nepseColor = nepseUp ? UP : DOWN;
  const hasNepse = nepsePoints.length > 1;

  const MoverRow = ({ stock }) => {
    const pct = Number(stock.percent_change || 0);
    const up = pct >= 0;
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-slate-800">{stock.symbol}</span>
          <span className="text-xs text-slate-400 truncate max-w-[150px]">
            {stock.company_name}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-700 tabular-nums">
            {fmtMoney(stock.current_price)}
          </div>
          <div
            className={`text-xs font-semibold inline-flex items-center gap-0.5 tabular-nums ${
              up ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(pct).toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm text-slate-500">
            Here's how the market is moving today
          </p>
        </div>
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          <Plus size={18} />
          <span>New Order</span>
        </button>
      </div>

      {/* NEPSE index performance chart */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center h-10 w-10 rounded-lg"
              style={{ backgroundColor: `${nepseColor}14`, color: nepseColor }}
            >
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">NEPSE Index</h2>
              <p className="text-xs text-slate-400">
                {nepse?.granularity === 'daily'
                  ? 'Recent daily performance'
                  : "Today's performance"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasNepse && (
              <div className="text-right">
                <div className="text-xl font-bold text-slate-800 tabular-nums">
                  {fmtIndex(nepse.current)}
                </div>
                <div
                  className={`text-sm font-semibold inline-flex items-center gap-0.5 tabular-nums ${
                    nepseUp ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {nepseUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {nepseUp ? '+' : ''}
                  {fmtIndex(nepseChange)} ({Math.abs(nepsePct).toFixed(2)}%)
                </div>
              </div>
            )}
            <button
              onClick={loadNepseIndex}
              disabled={nepseLoading}
              title="Refresh"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={16} className={nepseLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {hasNepse ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={nepsePoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nepseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={nepseColor} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={nepseColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#f1f5f9' }}
                minTickGap={48}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v) => Number(v).toFixed(0)}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
                      <span className="text-slate-400">{payload[0].payload.label}</span>
                      <span className="ml-2 font-bold text-slate-800 tabular-nums">
                        {fmtIndex(payload[0].value)}
                      </span>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={nepseColor}
                strokeWidth={2}
                fill="url(#nepseFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <Activity size={22} />
            </div>
            <p className="text-sm font-medium">
              {nepseLoading ? 'Loading NEPSE index…' : 'NEPSE index data unavailable.'}
            </p>
            {!nepseLoading && (
              <p className="text-xs text-slate-400 mt-1">
                The live NEPSE feed may be offline. It refreshes automatically.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Top Holdings</h2>
            <button
              onClick={() => navigate('/portfolio')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              View portfolio <ArrowRight size={13} />
            </button>
          </div>

          {topHoldings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <Briefcase size={22} />
              </div>
              <p className="text-sm font-medium">No holdings yet.</p>
              <button
                onClick={() => navigate('/orders')}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Place your first trade
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3">Asset</th>
                    <th className="px-6 py-3 text-right">Qty</th>
                    <th className="px-6 py-3 text-right">LTP</th>
                    <th className="px-6 py-3 text-right">Value</th>
                    <th className="px-6 py-3 text-right">P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {topHoldings.map((h) => {
                    const up = (h.profit_loss || 0) >= 0;
                    return (
                      <tr key={h.symbol} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{h.symbol}</span>
                            <span className="text-xs text-slate-400 truncate max-w-[160px]">
                              {h.company_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right text-slate-600 tabular-nums">
                          {h.quantity}
                        </td>
                        <td className="px-6 py-3.5 text-right text-slate-600 tabular-nums">
                          {fmtMoney(h.current_price)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-slate-800 tabular-nums">
                          {fmtMoney(h.current_value)}
                        </td>
                        <td
                          className={`px-6 py-3.5 text-right font-semibold tabular-nums ${
                            up ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {up ? '+' : '−'}
                          {Math.abs(h.profit_loss_percentage || 0).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Market movers */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Market Movers</h2>
            <button
              onClick={() => navigate('/market')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              Market <ArrowRight size={13} />
            </button>
          </div>

          {gainers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Market data unavailable.
            </div>
          ) : (
            <div className="px-6 py-2 divide-y divide-slate-100">
              <div className="py-2">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                  Top Gainers
                </p>
                {gainers.map((s) => (
                  <MoverRow key={`g-${s.stock_id}`} stock={s} />
                ))}
              </div>
              <div className="py-2">
                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">
                  Top Losers
                </p>
                {losers.map((s) => (
                  <MoverRow key={`l-${s.stock_id}`} stock={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Recent Activity</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            View all <ArrowRight size={13} />
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <Receipt size={22} />
            </div>
            <p className="text-sm font-medium">No activity yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((tx) => {
              const t = (tx.type || '').toUpperCase();
              const inflow = INFLOW_TYPES.has(t);
              const outflow = OUTFLOW_TYPES.has(t);
              const amt = Number(tx.amount || 0);
              return (
                <div
                  key={tx.transaction_id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${
                        inflow
                          ? 'bg-emerald-50 text-emerald-600'
                          : outflow
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {inflow ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                    </div>
                    <p className="text-sm text-slate-600 truncate max-w-md">
                      {tx.description || tx.type}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                      inflow ? 'text-emerald-600' : outflow ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {amt > 0 ? `${inflow ? '+' : outflow ? '−' : ''} Rs. ${fmtMoney(amt)}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
