// components/dashboard/Wallet.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { useBankStore } from '../../store/useBankStore';
import {
  Wallet as WalletIcon,
  Landmark,
  ArrowRight,
  ArrowUpFromLine,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Receipt,
  RefreshCw,
  Check,
  Clock,
} from 'lucide-react';

const STATUS_META = {
  PENDING: 'bg-amber-50 text-amber-600 border-amber-100',
  APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
};

// Money flowing INTO the wallet vs OUT of it, keyed by transaction type.
const INFLOW_TYPES = new Set(['SELL', 'ESCROW_RELEASE', 'DEPOSIT', 'CREDIT', 'REFUND']);
const OUTFLOW_TYPES = new Set(['BUY', 'WITHDRAW', 'DEBIT', 'ESCROW_HOLD']);
// Transactions that actually move cash in/out of the wallet balance.
const FUND_TYPES = new Set(['DEPOSIT', 'WITHDRAW']);

const flowOf = (type) => {
  const t = (type || '').toUpperCase();
  if (INFLOW_TYPES.has(t)) return 'in';
  if (OUTFLOW_TYPES.has(t)) return 'out';
  return 'neutral';
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const typeMeta = (type) => {
  const t = (type || '').toUpperCase();
  switch (t) {
    case 'DEPOSIT':
      return { label: 'Deposit', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    case 'WITHDRAW':
      return { label: 'Withdraw', cls: 'bg-rose-50 text-rose-600 border-rose-100' };
    case 'BUY':
      return { label: 'Buy', cls: 'bg-rose-50 text-rose-600 border-rose-100' };
    case 'SELL':
      return { label: 'Sell', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    case 'ESCROW_HOLD':
      return { label: 'Escrow Hold', cls: 'bg-amber-50 text-amber-600 border-amber-100' };
    case 'ESCROW_RELEASE':
      return { label: 'Cash Refund', cls: 'bg-blue-50 text-blue-600 border-blue-100' };
    case 'FUND_REQUEST':
      return { label: 'Fund Request', cls: 'bg-amber-50 text-amber-600 border-amber-100' };
    case 'FUND_APPROVED':
      return { label: 'Fund Approved', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    default:
      return {
        label: t.replace(/_/g, ' ').toLowerCase(),
        cls: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
};

const Wallet = () => {
  const navigate = useNavigate();
  const balance = useAppStore((s) => s.portfolio.balance);
  const fetchWallet = useAppStore((s) => s.fetchWallet);

  const transactions = useHistoryStore((s) => s.transactions);
  const txLoading = useHistoryStore((s) => s.isLoading);
  const fetchTransactions = useHistoryStore((s) => s.fetchTransactions);

  const withdrawals = useBankStore((s) => s.withdrawals);
  const fetchWithdrawals = useBankStore((s) => s.fetchWithdrawals);
  const requestWithdrawal = useBankStore((s) => s.requestWithdrawal);

  const [scope, setScope] = useState('FUNDS'); // FUNDS | ALL
  const [wdAmount, setWdAmount] = useState('');
  const [wdBusy, setWdBusy] = useState(false);
  const [wdFeedback, setWdFeedback] = useState(null); // { type, message }

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    fetchWithdrawals();
  }, [fetchWallet, fetchTransactions, fetchWithdrawals]);

  const refresh = () => {
    fetchWallet();
    fetchTransactions();
    fetchWithdrawals();
  };

  const handleWithdraw = async (e) => {
    e?.preventDefault();
    const value = Number(wdAmount);
    if (!value || value <= 0) {
      setWdFeedback({ type: 'error', message: 'Enter an amount greater than zero.' });
      return;
    }
    if (value > Number(balance)) {
      setWdFeedback({
        type: 'error',
        message: `You only have Rs. ${fmtAmount(balance)} in your wallet.`,
      });
      return;
    }
    setWdBusy(true);
    setWdFeedback(null);
    const result = await requestWithdrawal(value);
    setWdBusy(false);
    if (result.success) {
      setWdFeedback({
        type: 'success',
        message: `Withdrawal request for Rs. ${fmtAmount(value)} submitted. It moves to your bank once an admin approves it.`,
      });
      setWdAmount('');
    } else {
      setWdFeedback({ type: 'error', message: result.error || 'Withdrawal request failed.' });
    }
  };

  const ledger = useMemo(() => {
    if (scope === 'FUNDS') {
      return transactions.filter((tx) => FUND_TYPES.has((tx.type || '').toUpperCase()));
    }
    return transactions;
  }, [transactions, scope]);

  // Lifetime deposits/withdrawals for the summary tiles.
  const totals = useMemo(() => {
    let deposited = 0;
    let withdrawn = 0;
    for (const tx of transactions) {
      const t = (tx.type || '').toUpperCase();
      if (t === 'DEPOSIT') deposited += Number(tx.amount || 0);
      else if (t === 'WITHDRAW') withdrawn += Number(tx.amount || 0);
    }
    return { deposited, withdrawn };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Wallet</h1>
          <p className="text-sm text-slate-500">
            Manage the paper cash you trade with
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={txLoading}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={16} className={txLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance hero */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-sm">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/10" />
          <div className="absolute -right-2 top-16 h-24 w-24 rounded-full bg-emerald-500/10" />
          <div className="relative flex items-center gap-2 text-slate-300">
            <WalletIcon size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Available Balance
            </span>
          </div>
          <div className="relative mt-3 text-4xl font-bold tabular-nums">
            Rs. {fmtAmount(balance)}
          </div>
          <div className="relative mt-6 flex flex-wrap gap-6 text-sm">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                Total Deposited
              </span>
              <span className="font-semibold text-emerald-400 tabular-nums">
                Rs. {fmtAmount(totals.deposited)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                Total Withdrawn
              </span>
              <span className="font-semibold text-slate-300 tabular-nums">
                Rs. {fmtAmount(totals.withdrawn)}
              </span>
            </div>
          </div>
        </div>

        {/* Load funds — now handled via the E-Bank */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600">
              <Landmark size={17} />
            </div>
            <h2 className="text-sm font-bold">Load Funds</h2>
          </div>

          <p className="mt-3 text-sm text-slate-500 flex-1">
            Fund your trading wallet from your E-Bank. Loads are drawn from your
            bank balance — top it up there if you need more.
          </p>

          <button
            onClick={() => navigate('/ebank')}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <Landmark size={16} />
            Go to E-Bank
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Withdraw to bank */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-rose-50 text-rose-600">
            <ArrowUpFromLine size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold">Withdraw to Bank</h2>
            <p className="text-xs text-slate-500">
              Move cash from your wallet back to your bank. An admin reviews it —
              the wallet is debited only once approved.
            </p>
          </div>
        </div>

        <form onSubmit={handleWithdraw} className="mt-4 grid grid-cols-1 sm:grid-cols-[240px_auto] gap-3 items-start">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              Rs.
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={wdAmount}
              onChange={(e) => setWdAmount(e.target.value)}
              placeholder="Amount to withdraw"
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 tabular-nums focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={wdBusy}
            className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <ArrowUpFromLine size={16} />
            {wdBusy ? 'Requesting…' : 'Request Withdrawal'}
          </button>
        </form>

        {wdFeedback && (
          <div
            className={`mt-3 flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 ${
              wdFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {wdFeedback.type === 'success' && <Check size={14} />}
            {wdFeedback.message}
          </div>
        )}

        {withdrawals.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Withdrawal Requests
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-2 pr-4">Req #</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2 pr-4">Requested</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {withdrawals.map((w) => (
                    <tr key={w.request_id}>
                      <td className="py-2.5 pr-4 text-slate-400 tabular-nums">#{w.request_id}</td>
                      <td className="py-2.5 pr-4 text-right font-bold text-slate-800 tabular-nums">
                        Rs. {fmtAmount(w.amount)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">
                        {fmtDateTime(w.created_at)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            STATUS_META[w.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {w.status === 'PENDING' && <Clock size={11} />}
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Fund activity ledger */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Balance Activity</h2>
          <div className="inline-flex bg-slate-100 p-1 rounded-lg">
            {[
              { key: 'FUNDS', label: 'Deposits & Withdrawals' },
              { key: 'ALL', label: 'All Activity' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setScope(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  scope === tab.key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {txLoading && transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading activity…</p>
            </div>
          ) : ledger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <Receipt size={22} />
              </div>
              <p className="text-sm font-medium">
                {scope === 'FUNDS' ? 'No deposits or withdrawals yet.' : 'No activity yet.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {scope === 'FUNDS'
                  ? 'Load funds above to get started.'
                  : 'Your wallet movements will appear here.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {ledger.map((tx) => {
                  const meta = typeMeta(tx.type);
                  const flow = flowOf(tx.type);
                  const amt = Number(tx.amount || 0);
                  const amountCls =
                    flow === 'in'
                      ? 'text-emerald-600'
                      : flow === 'out'
                        ? 'text-rose-600'
                        : 'text-slate-400';
                  const sign = flow === 'in' ? '+' : flow === 'out' ? '−' : '';

                  return (
                    <tr key={tx.transaction_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {fmtDateTime(tx.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}
                        >
                          {flow === 'in' && <ArrowDownLeft size={12} />}
                          {flow === 'out' && <ArrowUpRight size={12} />}
                          {flow === 'neutral' && <RotateCcw size={12} />}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-md">
                        {tx.description || '—'}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-bold tabular-nums whitespace-nowrap ${amountCls}`}>
                        {amt > 0 ? `${sign} Rs. ${fmtAmount(amt)}` : '—'}
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

export default Wallet;
