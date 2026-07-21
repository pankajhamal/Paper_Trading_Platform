// components/admin/AdminWithdrawals.jsx
import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../../store/useAdminStore';
import { RefreshCw, Banknote, Check, X, Clock } from 'lucide-react';

const fmtMoney = (n) =>
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

const STATUS_META = {
  PENDING: 'bg-amber-50 text-amber-600 border-amber-100',
  APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
};

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

const AdminWithdrawals = () => {
  const withdrawals = useAdminStore((s) => s.withdrawals);
  const loading = useAdminStore((s) => s.loading);
  const error = useAdminStore((s) => s.error);
  const fetchWithdrawals = useAdminStore((s) => s.fetchWithdrawals);
  const approveWithdrawal = useAdminStore((s) => s.approveWithdrawal);
  const rejectWithdrawal = useAdminStore((s) => s.rejectWithdrawal);

  const [filter, setFilter] = useState('PENDING');
  const [busyId, setBusyId] = useState(null);
  const [banner, setBanner] = useState(null);

  const load = (f = filter) => fetchWithdrawals(f === 'ALL' ? undefined : f);

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const act = async (req, kind) => {
    setBusyId(req.request_id);
    const fn = kind === 'approve' ? approveWithdrawal : rejectWithdrawal;
    const result = await fn(req.request_id);
    setBusyId(null);
    if (result.success) {
      setBanner({
        type: 'success',
        message:
          kind === 'approve'
            ? `Request #${req.request_id} approved.`
            : `Request #${req.request_id} rejected — Rs. ${fmtMoney(req.amount)} refunded.`,
      });
      load();
    } else {
      setBanner({ type: 'error', message: result.error });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Withdrawals</h1>
          <p className="text-sm text-slate-500">Review and verify withdrawal requests</p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {banner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm font-medium ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Status filter */}
      <div className="inline-flex bg-slate-100 p-1 rounded-lg">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold capitalize transition-colors ${
              filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading && withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading requests…</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <Banknote size={22} />
              </div>
              <p className="text-sm font-medium">No {filter.toLowerCase()} requests.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3">Req #</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {withdrawals.map((r) => (
                  <tr key={r.request_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 tabular-nums">#{r.request_id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{r.user_name || '—'}</span>
                        <span className="text-xs text-slate-400">{r.user_email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">
                      Rs. {fmtMoney(r.amount)}
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
                    <td className="px-5 py-3.5 text-right">
                      {r.status === 'PENDING' ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => act(r, 'approve')}
                            disabled={busyId === r.request_id}
                            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Check size={13} />
                            Approve
                          </button>
                          <button
                            onClick={() => act(r, 'reject')}
                            disabled={busyId === r.request_id}
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <X size={13} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {r.reviewed_at ? `Reviewed ${fmtDateTime(r.reviewed_at)}` : '—'}
                        </span>
                      )}
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

export default AdminWithdrawals;
