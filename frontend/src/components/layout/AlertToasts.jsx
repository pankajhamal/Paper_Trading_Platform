// components/layout/AlertToasts.jsx
// Pops a toast the moment a price alert trips. Mounted once in the dashboard
// shell so it fires on any screen, not just the Alerts page.
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useAlertsStore } from '../../store/useAlertsStore';

const AUTO_DISMISS_MS = 9000;

const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Toast = ({ alert, onDismiss, onOpen }) => {
  const up = alert.condition === 'ABOVE';

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="flex items-start gap-3 w-80 px-4 py-3 rounded-xl shadow-lg border border-slate-200 bg-white">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}
      >
        <BellRing size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Price alert triggered
        </p>
        <p className="text-sm font-bold text-slate-900 truncate">
          {alert.symbol}
        </p>
        <p className="flex items-center gap-1 text-sm font-semibold text-slate-600 tabular-nums">
          {up ? (
            <ArrowUp size={13} className="text-emerald-600" />
          ) : (
            <ArrowDown size={13} className="text-rose-600" />
          )}
          {up ? 'Rose to' : 'Fell to'} Rs. {fmtPrice(alert.current_price)}
          <span className="text-slate-400 font-medium">
            (target {fmtPrice(alert.target_price)})
          </span>
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          View alerts
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss alert notification"
        className="text-slate-300 hover:text-slate-500 shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
};

const AlertToasts = () => {
  const navigate = useNavigate();
  const toasts = useAlertsStore((s) => s.toasts);
  const dismissToast = useAlertsStore((s) => s.dismissToast);
  const markSeen = useAlertsStore((s) => s.markSeen);
  const startWatching = useAlertsStore((s) => s.startWatching);
  const stopWatching = useAlertsStore((s) => s.stopWatching);

  useEffect(() => {
    startWatching();
    return stopWatching;
  }, [startWatching, stopWatching]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[10000] flex flex-col-reverse gap-2">
      {/* Newest on top; cap the stack so a burst of triggers can't cover the app. */}
      {toasts.slice(-3).map((alert) => (
        <Toast
          key={alert.alert_id}
          alert={alert}
          onDismiss={() => dismissToast(alert.alert_id)}
          onOpen={() => {
            markSeen(alert.alert_id);
            dismissToast(alert.alert_id);
            navigate('/alerts');
          }}
        />
      ))}
    </div>
  );
};

export default AlertToasts;
