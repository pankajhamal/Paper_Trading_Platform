// sidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { assetUrl } from '../../services/api';
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
  LogOut,
  CandlestickChart,
  Wallet,
  Landmark,
} from 'lucide-react';

// Navigation grouped into labelled sections, the way a real trading terminal
// organises its workspace rather than one long flat list.
const NAV_SECTIONS = [
  {
    title: null,
    items: [{ name: 'Dashboard', icon: LayoutDashboard, path: '/' }],
  },
  {
    title: 'Trading',
    items: [
      { name: 'Portfolio', icon: Briefcase, path: '/portfolio' },
      { name: 'Orders', icon: ClipboardList, path: '/orders' },
      { name: 'Market', icon: TrendingUp, path: '/market' },
      { name: 'Watchlist', icon: Eye, path: '/watchlist' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Charts', icon: LineChart, path: '/charts' },
      { name: 'History', icon: History, path: '/history' },
      { name: 'Alerts', icon: BellRing, path: '/alerts' },
    ],
  },
  {
    title: 'Account',
    items: [
      { name: 'E-Bank', icon: Landmark, path: '/ebank' },
      { name: 'Wallet', icon: Wallet, path: '/wallet' },
      { name: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  const username = user?.name || user?.email?.split('@')[0] || 'Trader';
  const email = user?.email || '';
  const initial = username.charAt(0).toUpperCase();
  const avatarSrc = assetUrl(user?.avatar_url);

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen select-none z-20">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/20">
          <CandlestickChart size={19} strokeWidth={2.25} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold text-slate-900 tracking-tight">
            PaperTrade
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.12em]">
            NEPSE Simulator
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.title || `section-${idx}`}>
            {section.title && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className={`group relative w-full flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {/* Active accent bar */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-blue-600 transition-opacity duration-150 ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <Icon
                      size={18}
                      strokeWidth={2}
                      className={
                        isActive
                          ? 'text-blue-600'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }
                    />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account footer */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Profile"
              className="h-9 w-9 shrink-0 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-slate-800 text-white font-semibold text-sm">
              {initial}
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {username}
            </span>
            <span className="text-xs text-slate-400 truncate">
              {email || 'Paper account'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
