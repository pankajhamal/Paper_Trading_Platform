// dashboard.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';

function Dashboard() {
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
    </div>
  );
}

export default Dashboard;