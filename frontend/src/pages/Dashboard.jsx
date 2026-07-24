// dashboard.jsx
import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import AlertToasts from '../components/layout/AlertToasts';
import { useAppStore } from '../store/useAppStore';
import { isTokenExpired } from '../services/api';

function Dashboard() {
  const navigate = useNavigate();
  const logout = useAppStore((state) => state.logout);

  // Watch the session even while idle: if the token expires with no API calls
  // in flight, log the user out and send them to login without waiting for the
  // next request to 401.
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
      {/* 1. Sidebar on the left (spanning full height) */}
      <Sidebar />

      {/* 2. Main Area on the right */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 3. Navbar at the top of the main area */}
        <Navbar />

        {/* 4. Page Content area (scrollable) */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* Price-alert popups — mounted here so they fire on any dashboard screen */}
      <AlertToasts />
    </div>
  );
}

export default Dashboard;