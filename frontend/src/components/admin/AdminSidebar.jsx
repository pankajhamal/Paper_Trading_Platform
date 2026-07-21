// components/admin/AdminSidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { assetUrl } from '../../services/api';
import {
  LayoutDashboard,
  Users,
  Banknote,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

// Admin navigation, mirroring the user Sidebar's grouped layout.
const NAV_SECTIONS = [
  {
    title: null,
    items: [{ name: 'Overview', icon: LayoutDashboard, path: '/admin' }],
  },
  {
    title: 'Management',
    items: [
      { name: 'Users', icon: Users, path: '/admin/users' },
      { name: 'Withdrawals', icon: Banknote, path: '/admin/withdrawals' },
    ],
  },
];

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  const username = user?.name || user?.email?.split('@')[0] || 'Admin';
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
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-900 text-white shadow-sm">
          <ShieldCheck size={19} strokeWidth={2.25} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold text-slate-900 tracking-tight">
            Admin Panel
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.12em]">
            PaperTrade Control
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
                // Exact match for the index route, prefix match for the rest.
                const isActive =
                  item.path === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname.startsWith(item.path);

                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className={`group relative w-full flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      size={18}
                      strokeWidth={2}
                      className={
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
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
            <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-slate-900 text-white font-semibold text-sm">
              {initial}
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-slate-800 truncate">{username}</span>
            <span className="text-xs text-slate-400 truncate">{email || 'Administrator'}</span>
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

export default AdminSidebar;
