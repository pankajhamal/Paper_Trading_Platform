// components/dashboard/EBank.jsx
import React, { useEffect, useState } from 'react';
import { useBankStore } from '../../store/useBankStore';
import { useAppStore } from '../../store/useAppStore';
import {
  Landmark,
  ArrowDownToLine,
  HandCoins,
  RefreshCw,
  Check,
  Clock,
} from 'lucide-react';

// The platform's single bank — money is loaded from here into the wallet.
const BANK_NAME = 'PaperTrade Bank';

const STATUS_META = {
  PENDING: 'bg-amber-50 text-amber-600 border-amber-100',
  APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
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

const EBank = () => {
  const bank = useBankStore((s) => s.bank);
  const requests = useBankStore((s) => s.requests);
  const isLoading = useBankStore((s) => s.isLoading);
  const fetchBank = useBankStore((s) => s.fetchBank);
  const fetchRequests = useBankStore((s) => s.fetchRequests);
  const loadToWallet = useBankStore((s) => s.loadToWallet);
  const requestFunds = useBankStore((s) => s.requestFunds);

  const walletBalance = useAppStore((s) => s.portfolio.balance);
  const fetchWallet = useAppStore((s) => s.fetchWallet);

  const [loadAmount, setLoadAmount] = useState('');
  const [loadBusy, setLoadBusy] = useState(false);
  const [loadFeedback, setLoadFeedback] = useState(null);

  const [reqAmount, setReqAmount] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqFeedback, setReqFeedback] = useState(null);

  useEffect(() => {
    fetchBank();
    fetchRequests();
    fetchWallet();
  }, [fetchBank, fetchRequests, fetchWallet]);

  const refresh = () => {
    fetchBank();
    fetchRequests();
    fetchWallet();
  };

  const handleLoad = async (e) => {
    e?.preventDefault();
    const value = Number(loadAmount);
    if (!value || value <= 0) {
      setLoadFeedback({ type: 'error', message: 'Enter an amount greater than zero.' });
      return;
    }
    if (value > Number(bank.balance)) {
      setLoadFeedback({
        type: 'error',
        message: `Only Rs. ${fmtAmount(bank.balance)} available. Request more funds below.`,
      });
      return;
    }
    setLoadBusy(true);
    setLoadFeedback(null);
    const result = await loadToWallet(value, BANK_NAME);
    setLoadBusy(false);
    if (result.success) {
      setLoadFeedback({
        type: 'success',
        message: `Rs. ${fmtAmount(value)} loaded from ${BANK_NAME} into your wallet.`,
      });
      setLoadAmount('');
    } else {
      setLoadFeedback({ type: 'error', message: result.error || 'Load failed.' });
    }
  };

  const handleRequest = async (e) => {
    e?.preventDefault();
    const value = Number(reqAmount);
    if (!value || value <= 0) {
      setReqFeedback({ type: 'error', message: 'Enter an amount greater than zero.' });
      return;
    }
    setReqBusy(true);
    setReqFeedback(null);
    const result = await requestFunds(value, reqNote);
    setReqBusy(false);
    if (result.success) {
      setReqFeedback({
        type: 'success',
        message: `Requested Rs. ${fmtAmount(value)}. An admin will review it shortly.`,
      });
      setReqAmount('');
      setReqNote('');
    } else {
      setReqFeedback({ type: 'error', message: result.error || 'Request failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">E-Bank</h1>
          <p className="text-sm text-slate-500">
            Load money from your bank into your trading wallet
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank balance hero */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-sm">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/10" />
          <div className="absolute -right-2 top-16 h-24 w-24 rounded-full bg-emerald-500/10" />
          <div className="relative flex items-center gap-2 text-slate-300">
            <Landmark size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              E-Bank Balance
            </span>
          </div>
          <div className="relative mt-3 text-4xl font-bold tabular-nums">
            Rs. {fmtAmount(bank.balance)}
          </div>
          <div className="relative mt-6 flex flex-wrap gap-6 text-sm">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                Linked Bank
              </span>
              <span className="font-semibold text-slate-200">
                {bank.bank_name || '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                Wallet Balance
              </span>
              <span className="font-semibold text-emerald-400 tabular-nums">
                Rs. {fmtAmount(walletBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Load to wallet */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600">
              <ArrowDownToLine size={17} />
            </div>
            <h2 className="text-sm font-bold">Load to Wallet</h2>
          </div>

          <form onSubmit={handleLoad} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Bank</label>
              <div className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium">
                <Landmark size={15} className="text-slate-400" />
                {BANK_NAME}
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                Rs.
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={loadAmount}
                onChange={(e) => setLoadAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 tabular-nums focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
              />
            </div>

            {loadFeedback && (
              <div
                className={`flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 ${
                  loadFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {loadFeedback.type === 'success' && <Check size={14} />}
                {loadFeedback.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loadBusy}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              <ArrowDownToLine size={16} />
              {loadBusy ? 'Loading…' : 'Load to Wallet'}
            </button>
          </form>
        </div>
      </div>

      {/* Request more funds */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600">
            <HandCoins size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold">Request More Funds</h2>
            <p className="text-xs text-slate-500">
              Need more than your e-bank holds? Request a top-up — an admin approves it.
            </p>
          </div>
        </div>

        <form onSubmit={handleRequest} className="mt-4 grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3 items-start">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              Rs.
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={reqAmount}
              onChange={(e) => setReqAmount(e.target.value)}
              placeholder="Amount"
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 tabular-nums focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none placeholder:text-slate-400"
            />
          </div>
          <input
            type="text"
            value={reqNote}
            onChange={(e) => setReqNote(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={reqBusy}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <HandCoins size={16} />
            {reqBusy ? 'Requesting…' : 'Request'}
          </button>
        </form>

        {reqFeedback && (
          <div
            className={`mt-3 flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 ${
              reqFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {reqFeedback.type === 'success' && <Check size={14} />}
            {reqFeedback.message}
          </div>
        )}
      </div>

      {/* Request history */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Fund Requests</h2>
        </div>

        <div className="overflow-x-auto">
          {isLoading && requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading requests…</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <HandCoins size={22} />
              </div>
              <p className="text-sm font-medium">No fund requests yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Requests you make appear here with their status.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3">Req #</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {requests.map((r) => (
                  <tr key={r.request_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 tabular-nums">#{r.request_id}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">
                      Rs. {fmtAmount(r.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                      {r.note || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          STATUS_META[r.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {r.status === 'PENDING' && <Clock size={11} />}
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default EBank;
