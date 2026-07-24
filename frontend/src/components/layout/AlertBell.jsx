// components/layout/AlertBell.jsx
// Navbar bell: unread count of triggered price alerts, with a dropdown listing
// them. The badge persists across reloads until the user acknowledges it, so a
// trigger can't be missed just by not being on the Alerts screen at the time.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, ArrowUp, ArrowDown, CheckCheck } from 'lucide-react';
import { useAlertsStore } from '../../store/useAlertsStore';

const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const AlertBell = () => {
  const navigate = useNavigate();
  const unseen = useAlertsStore((s) => s.unseen);
  const markSeen = useAlertsStore((s) => s.markSeen);
  const startWatching = useAlertsStore((s) => s.startWatching);
  const stopWatching = useAlertsStore((s) => s.stopWatching);

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    startWatching();
    return stopWatching;
  }, [startWatching, stopWatching]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const count = unseen.length;

  const openAlert = (alert) => {
    markSeen(alert.alert_id);
    setOpen(false);
    navigate('/alerts');
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `${count} triggered price alerts` : 'Price alerts'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        {count ? (
          <BellRing size={19} className="text-blue-600" />
        ) : (
          <Bell size={19} />
        )}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white tabular-nums">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">
              Triggered alerts
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markSeen()}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={22} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Nothing new
              </p>
              <p className="text-xs text-slate-400">
                Watching alerts will show up here when they trip.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {unseen.map((alert) => {
                const up = alert.condition === 'ABOVE';
                return (
                  <li key={alert.alert_id}>
                    <button
                      type="button"
                      onClick={() => openAlert(alert)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          up
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 truncate">
                          {alert.symbol}
                        </span>
                        <span className="block text-xs font-semibold text-slate-600 tabular-nums">
                          {up ? 'Rose to' : 'Fell to'} Rs.{' '}
                          {fmtPrice(alert.current_price)} · target{' '}
                          {fmtPrice(alert.target_price)}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {fmtTime(alert.triggered_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/alerts');
            }}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-slate-50"
          >
            View all alerts
          </button>
        </div>
      )}
    </div>
  );
};

export default AlertBell;
