// components/admin/AdminOverview.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import {
  Users,
  UserCheck,
  UserX,
  Banknote,
  Wallet,
  Clock,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const StatTile = ({ icon: Icon, label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-500',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm">
      <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-lg font-bold text-slate-800 tabular-nums truncate">{value}</span>
      </div>
    </div>
  );
};

const AdminOverview = () => {
  const navigate = useNavigate();
  const overview = useAdminStore((s) => s.overview);
  const fetchOverview = useAdminStore((s) => s.fetchOverview);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const o = overview || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
          <p className="text-sm text-slate-500">A snapshot of platform activity</p>
        </div>
        <button
          onClick={fetchOverview}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <StatTile icon={Users} label="Total Users" value={o.total_users ?? '—'} tone="blue" />
        <StatTile icon={UserCheck} label="Active Users" value={o.active_users ?? '—'} tone="emerald" />
        <StatTile icon={UserX} label="Disabled Users" value={o.disabled_users ?? '—'} tone="rose" />
        <StatTile
          icon={Wallet}
          label="Total Wallet Cash"
          value={`Rs. ${fmtMoney(o.total_wallet_balance)}`}
          tone="slate"
        />
        <StatTile
          icon={Clock}
          label="Pending Withdrawals"
          value={o.pending_withdrawals ?? '—'}
          tone="amber"
        />
        <StatTile
          icon={Banknote}
          label="Pending Amount"
          value={`Rs. ${fmtMoney(o.pending_withdrawals_amount)}`}
          tone="amber"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/admin/withdrawals')}
          className="group flex items-center justify-between bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-50 text-amber-600">
              <Banknote size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Review Withdrawals</p>
              <p className="text-xs text-slate-500">
                {o.pending_withdrawals ? `${o.pending_withdrawals} awaiting approval` : 'Approve or reject requests'}
              </p>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/users')}
          className="group flex items-center justify-between bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 text-blue-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Manage Users</p>
              <p className="text-xs text-slate-500">View, disable or re-enable accounts</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
        </button>
      </div>
    </div>
  );
};

export default AdminOverview;
