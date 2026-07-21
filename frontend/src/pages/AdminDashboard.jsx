// pages/AdminDashboard.jsx
import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useAppStore } from '../store/useAppStore';
import { isTokenExpired } from '../services/api';

function AdminDashboard() {
  const navigate = useNavigate();
  const logout = useAppStore((state) => state.logout);
  const user = useAppStore((state) => state.user);

  // Same idle session watcher as the trading workspace: log out on token expiry.
  useEffect(() => {
    const check = () => {
      if (isTokenExpired(localStorage.getItem('token'))) {
        logout();
        navigate('/login', { replace: true });
      }
    };
    check();
    const timer = setInterval(check, 10000);
    return () => clearInterval(timer);
  }, [logout, navigate]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-slate-800">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Slim admin top bar */}
        <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between select-none z-10">
          <div className="flex flex-col leading-tight">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Administration
            </h1>
            <span className="text-xs text-slate-400 font-medium">
              Platform management &amp; oversight
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide">
              {user?.name || 'Admin'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
