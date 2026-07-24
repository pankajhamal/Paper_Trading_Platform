// components/dashboard/Alerts.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAlertsStore } from '../../store/useAlertsStore';
import { useAppStore } from '../../store/useAppStore';
import {
  Search,
  BellRing,
  BellOff,
  Bell,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  Plus,
} from 'lucide-react';

const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (value) => {
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

const Alerts = () => {
  const alerts = useAlertsStore((s) => s.alerts);
  const isLoading = useAlertsStore((s) => s.isLoading);
  const fetchAlerts = useAlertsStore((s) => s.fetchAlerts);
  const createAlert = useAlertsStore((s) => s.createAlert);
  const deleteAlert = useAlertsStore((s) => s.deleteAlert);
  const markSeen = useAlertsStore((s) => s.markSeen);

  const stocks = useAppStore((s) => s.marketTickers);
  const fetchTickers = useAppStore((s) => s.fetchTickers);

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [picked, setPicked] = useState(null); // selected stock object
  const [condition, setCondition] = useState('ABOVE');
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const searchRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    fetchAlerts();
    fetchTickers();
  }, [fetchAlerts, fetchTickers]);

  // Looking at this screen counts as reading the notifications: clear the bell
  // badge once the loaded list is on screen.
  useEffect(() => {
    if (alerts.length) markSeen();
  }, [alerts, markSeen]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const notify = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return stocks
      .filter(
        (s) =>
          s.symbol?.toUpperCase().includes(q) ||
          s.company_name?.toUpperCase().includes(q),
      )
      .slice(0, 6);
  }, [stocks, query]);

  const pickStock = (stock) => {
    setPicked(stock);
    setQuery('');
    setShowResults(false);
    // Sensible default target: 5% away in the chosen direction
    const price = Number(stock.current_price || 0);
    if (price > 0) {
      const suggested = condition === 'ABOVE' ? price * 1.05 : price * 0.95;
      setTarget(suggested.toFixed(2));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!picked) {
      notify('Search and select a stock first.', 'error');
      return;
    }
    const price = parseFloat(target);
    if (!price || price <= 0) {
      notify('Enter a valid target price.', 'error');
      return;
    }
    setSubmitting(true);
    const result = await createAlert(picked.symbol, condition, price);
    setSubmitting(false);
    if (result.success) {
      notify(`Alert set for ${picked.symbol}.`, 'success');
      setPicked(null);
      setTarget('');
    } else {
      notify(result.error, 'error');
    }
  };

  const handleDelete = async (alert) => {
    const result = await deleteAlert(alert.alert_id);
    notify(
      result.success ? 'Alert removed.' : result.error,
      result.success ? 'success' : 'error',
    );
  };

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;

  const currentPrice = picked ? Number(picked.current_price || 0) : 0;

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Price Alerts</h1>
        <p className="text-sm text-slate-500">
          Get notified when a stock hits your target price
        </p>
      </div>

      {/* Create alert card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Create Alert</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Stock search */}
          <div className="relative" ref={searchRef}>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Stock
            </label>
            {picked ? (
              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3.5 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">
                    {picked.symbol}
                  </span>
                  <span className="text-xs text-slate-400">
                    {picked.company_name} · LTP Rs. {fmtPrice(currentPrice)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setTarget('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <Search
                  size={16}
                  className="absolute left-3 top-[34px] text-slate-400"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search symbol or company…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400"
                />
                {showResults && query.trim() && (
                  <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    {suggestions.length > 0 ? (
                      suggestions.map((s) => (
                        <button
                          type="button"
                          key={s.stock_id}
                          onClick={() => pickStock(s)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-slate-800">
                              {s.symbol}
                            </span>
                            <span className="text-xs text-slate-400 truncate max-w-[220px]">
                              {s.company_name}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 tabular-nums">
                            Rs. {fmtPrice(s.current_price)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        No matches for “{query.trim().toUpperCase()}”.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Condition + target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Condition
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCondition('ABOVE')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-md text-xs font-bold transition-colors ${
                    condition === 'ABOVE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <ArrowUp size={13} /> Above
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('BELOW')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-md text-xs font-bold transition-colors ${
                    condition === 'BELOW'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <ArrowDown size={13} /> Below
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Target Price (Rs.)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 550.00"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {picked && currentPrice > 0 && (
            <p className="text-xs text-slate-400">
              Notify me when <span className="font-semibold text-slate-600">{picked.symbol}</span>{' '}
              goes {condition === 'ABOVE' ? 'above' : 'below'}{' '}
              <span className="font-semibold text-slate-600">Rs. {target || '—'}</span> (currently
              Rs. {fmtPrice(currentPrice)}).
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              <Plus size={16} />
              {submitting ? 'Setting…' : 'Set Alert'}
            </button>
          </div>
        </form>
      </div>

      {/* Alerts list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Your Alerts</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full border border-amber-100">
              {activeCount} Active
            </span>
            <span className="bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
              {triggeredCount} Triggered
            </span>
          </div>
        </div>

        {isLoading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-sm font-medium">Loading alerts…</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <BellOff size={22} />
            </div>
            <p className="text-sm font-medium">No alerts yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Create one above to get notified on price moves.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => {
              const triggered = alert.status === 'TRIGGERED';
              const isAbove = alert.condition === 'ABOVE';
              return (
                <div
                  key={alert.alert_id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${
                        triggered
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {triggered ? <BellRing size={18} /> : <Bell size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {alert.symbol}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                            isAbove ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isAbove ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {isAbove ? 'Above' : 'Below'} Rs. {fmtPrice(alert.target_price)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {triggered
                          ? `Triggered ${fmtDate(alert.triggered_at)}`
                          : `Current: Rs. ${fmtPrice(alert.current_price)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        triggered
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                      }`}
                    >
                      {triggered ? 'Triggered' : 'Watching'}
                    </span>
                    <button
                      onClick={() => handleDelete(alert)}
                      title="Delete alert"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 z-[10000] transition-all duration-500 ease-in-out transform ${
          toast
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        {toast && (
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
