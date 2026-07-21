// components/admin/AdminUsers.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAdminStore } from '../../store/useAdminStore';
import { Search, RefreshCw, Users as UsersIcon, ShieldCheck, Ban, RotateCcw, X } from 'lucide-react';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const AdminUsers = () => {
  const users = useAdminStore((s) => s.users);
  const loading = useAdminStore((s) => s.loading);
  const error = useAdminStore((s) => s.error);
  const fetchUsers = useAdminStore((s) => s.fetchUsers);
  const disableUser = useAdminStore((s) => s.disableUser);
  const activateUser = useAdminStore((s) => s.activateUser);

  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null); // user pending disable confirmation
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null); // { type, message }

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q),
    );
  }, [users, query]);

  const confirmDisable = async () => {
    if (!target) return;
    setBusy(true);
    const result = await disableUser(target.user_id);
    setBusy(false);
    setTarget(null);
    setBanner(
      result.success
        ? { type: 'success', message: `${target.full_name || target.email} disabled.` }
        : { type: 'error', message: result.error },
    );
  };

  const handleActivate = async (user) => {
    const result = await activateUser(user.user_id);
    setBanner(
      result.success
        ? { type: 'success', message: `${user.full_name || user.email} re-enabled.` }
        : { type: 'error', message: result.error },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
          <p className="text-sm text-slate-500">{users.length} registered accounts</p>
        </div>
        <button
          onClick={fetchUsers}
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

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm font-medium">Loading users…</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <UsersIcon size={22} />
              </div>
              <p className="text-sm font-medium">No users match your search.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visible.map((u) => {
                  const isAdmin = (u.role || '').toLowerCase() === 'admin';
                  return (
                    <tr key={u.user_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 tabular-nums">{u.user_id}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {u.full_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            isAdmin
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isAdmin && <ShieldCheck size={11} />}
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-700 tabular-nums">
                        Rs. {fmtMoney(u.balance)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            u.is_active ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isAdmin ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : u.is_active ? (
                          <button
                            onClick={() => setTarget(u)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Ban size={13} />
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(u)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <RotateCcw size={13} />
                            Re-enable
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Disable confirmation modal */}
      {target && (
        <div className="fixed inset-0 w-screen h-screen bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Disable User</h2>
              <button
                onClick={() => setTarget(null)}
                disabled={busy}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Disable{' '}
                <span className="font-bold">{target.full_name || target.email}</span>? They
                will be logged out and blocked from signing in. Their wallet and history are
                preserved, and you can re-enable them anytime.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  disabled={busy}
                  className="py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDisable}
                  disabled={busy}
                  className="py-2.5 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
                >
                  {busy ? 'Disabling…' : 'Disable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
