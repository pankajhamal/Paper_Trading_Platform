// components/TabContentPlaceholder.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';

function TabContentPlaceholder() {
  const location = useLocation();

  const pathToTitle = {
    '/': 'Dashboard',
    '/portfolio': 'Portfolio',
    '/orders': 'Orders',
    '/charts': 'Charts',
    '/market': 'Market',
    '/watchlist': 'Watchlist',
    '/history': 'History',
    '/alerts': 'Alerts',
    '/settings': 'Settings',
  };

  const title = pathToTitle[location.pathname] || 'Dashboard';

  return (
    <div className="border border-dashed border-slate-200 rounded-lg p-6 h-full flex flex-col justify-center items-center bg-white shadow-sm">
      <h1 className="text-2xl font-bold mb-2 text-slate-800">{title}</h1>
      <p className="text-slate-400">Content rendering dynamic views will go here.</p>
    </div>
  );
}

export default TabContentPlaceholder;