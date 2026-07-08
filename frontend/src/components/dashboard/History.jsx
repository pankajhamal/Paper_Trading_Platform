// components/dashboard/History.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useHistoryStore } from '../../store/useHistoryStore';
import {
  Search,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Receipt,
} from 'lucide-react';

// Money flowing INTO the wallet vs OUT of it, keyed by transaction type.
const INFLOW_TYPES = new Set(['SELL', 'ESCROW_RELEASE', 'DEPOSIT', 'CREDIT', 'REFUND']);
const OUTFLOW_TYPES = new Set(['BUY', 'WITHDRAW', 'DEBIT']);

const flowOf = (type) => {
  const t = (type || '').toUpperCase();
  if (INFLOW_TYPES.has(t)) return 'in';
  if (OUTFLOW_TYPES.has(t)) return 'out';
  return 'neutral'; // e.g. ASSET_ESCROW_RELEASE (shares moved, amount = 0)
};

const fmtAmount = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Human label + styling for each transaction type
const typeMeta = (type) => {
  const t = (type || '').toUpperCase();
  switch (t) {
    case 'BUY':
      return { label: 'Buy', cls: 'bg-rose-50 text-rose-600 border-rose-100' };
    case 'SELL':
      return { label: 'Sell', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    case 'ESCROW_RELEASE':
      return { label: 'Cash Refund', cls: 'bg-blue-50 text-blue-600 border-blue-100' };
    case 'ASSET_ESCROW_RELEASE':
      return { label: 'Shares Returned', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return {
        label: t.replace(/_/g, ' ').toLowerCase(),
        cls: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
};

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'BUY', label: 'Buys' },
  { key: 'SELL', label: 'Sells' },
  { key: 'REFUND', label: 'Refunds' },
];

const History = () => {
  const transactions = useHistoryStore((s) => s.transactions);
  const isLoading = useHistoryStore((s) => s.isLoading);
  const error = useHistoryStore((s) => s.error);
  const fetchTransactions = useHistoryStore((s) => s.fetchTransactions);

  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Summary of cash in vs out across the whole ledger
  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of transactions) {
      const flow = flowOf(tx.type);
      const amt = Number(tx.amount || 0);
      if (flow === 'in') inflow += amt;
      else if (flow === 'out') outflow += amt;
    }
    return { count: transactions.length, inflow, outflow };
  }, [transactions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matchesFilter = (tx) => {
      const t = (tx.type || '').toUpperCase();
      if (filter === 'ALL') return true;
      if (filter === 'BUY') return t === 'BUY';
      if (filter === 'SELL') return t === 'SELL';
      if (filter === 'REFUND') return t === 'ESCROW_RELEASE' || t === 'ASSET_ESCROW_RELEASE';
      return true;
    };

    return transactions.filter(
      (tx) =>
        matchesFilter(tx) &&
        (!q ||
          (tx.description || '').toLowerCase().includes(q) ||
          (tx.type || '').toLowerCase().includes(q)),
    );
  }, [transactions, filter, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transaction History</h1>
          <p className="text-sm text-slate-500">
            Complete ledger of your account activity
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-100 text-slate-500">
            <Receipt size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Transactions
            </span>
            <span className="text-lg font-bold text-slate-800 tabular-nums">
              {summary.count}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600">
            <ArrowDownLeft size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total In
            </span>
            <span className="text-lg font-bold text-emerald-600 tabular-nums">
              Rs. {fmtAmount(summary.inflow)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-rose-50 text-rose-600">
            <ArrowUpRight size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Out
            </span>
            <span className="text-lg font-bold text-rose-600 tabular-nums">
              Rs. {fmtAmount(summary.outflow)}
            </span>
          </div>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-slate-100 p-1 rounded-lg">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
                filter === f.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Ledger table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading && transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading transactions…</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
              <p className="text-xs text-slate-400 mt-1">Try refreshing in a moment.</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <Receipt size={22} />
              </div>
              <p className="text-sm font-medium">No transactions yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Your buys, sells and refunds will appear here.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm font-medium">No transactions match your filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Date &amp; Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visible.map((tx) => {
                  const meta = typeMeta(tx.type);
                  const flow = flowOf(tx.type);
                  const amount = Number(tx.amount || 0);
                  const amountCls =
                    flow === 'in'
                      ? 'text-emerald-600'
                      : flow === 'out'
                        ? 'text-rose-600'
                        : 'text-slate-400';
                  const sign = flow === 'in' ? '+' : flow === 'out' ? '−' : '';

                  return (
                    <tr key={tx.transaction_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">
                        {fmtDateTime(tx.created_at)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}
                        >
                          {flow === 'in' && <ArrowDownLeft size={12} />}
                          {flow === 'out' && <ArrowUpRight size={12} />}
                          {flow === 'neutral' && <RotateCcw size={12} />}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 max-w-md">
                        {tx.description || '—'}
                      </td>
                      <td className={`px-6 py-3.5 text-right font-bold tabular-nums whitespace-nowrap ${amountCls}`}>
                        {amount > 0 ? `${sign} Rs. ${fmtAmount(amount)}` : '—'}
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

export default History;
