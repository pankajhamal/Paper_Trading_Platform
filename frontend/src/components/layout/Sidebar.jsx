// sidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  TrendingUp,
  LineChart,
  Eye,
  History,
  BellRing,
  Settings,
  LogOut
} from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const logoutUser = useAppStore((state) => state.logoutUser);

    const username = user?.name || user?.username || "Guest";

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Portfolio', icon: Briefcase, path: '/portfolio' },
    { name: 'Orders', icon: ClipboardList, path: '/orders' },
    { name: 'Charts', icon: LineChart, path: '/charts' },
    { name: 'Market', icon: TrendingUp, path: '/market' },
    { name: 'Watchlist', icon: Eye, path: '/watchlist' },
    { name: 'History', icon: History, path: '/history' },
    { name: 'Alerts', icon: BellRing, path: '/alerts' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const handleTabClick = (item) => {
    navigate(item.path);
  };

  const handleLogout = () => {
    if (logoutUser) {
      logoutUser();
    }
    navigate('/welcome');
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen justify-between select-none z-20">
      <div>
        {/* Brand Header */}
        <div className="flex items-center space-x-3 px-6 py-5 border-b border-slate-200">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
            <TrendingUp size={20} />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-wide">
            PaperTrade
          </span>
        </div>

        {/* Profile Card */}
        <div className="flex items-center space-x-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-sm">
            {username.charAt(0)}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold text-slate-800 truncate">{username}</span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Verified User</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            // Evaluates active menu item matching current browser path directly
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.name}
                onClick={() => handleTabClick(item)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 border border-blue-100/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150 border border-transparent hover:border-rose-100"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;