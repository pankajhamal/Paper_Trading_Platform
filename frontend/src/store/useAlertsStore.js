// src/store/useAlertsStore.js
import { create } from 'zustand';
import API from '../services/api';

// The backend trips alerts from a 60s background loop (service/alert_checker.py),
// so polling faster than that would only burn requests without seeing anything new.
const POLL_INTERVAL_MS = 60000;

// Triggered alerts the user has already been shown. Persisted per account so a
// reload — or logging in on a shared browser — doesn't re-announce old alerts.
const seenStorageKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return `alerts:seen:${user?.email || 'anon'}`;
  } catch {
    return 'alerts:seen:anon';
  }
};

const loadSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenStorageKey()) || '[]'));
  } catch {
    return new Set();
  }
};

const saveSeen = (ids) => {
  try {
    localStorage.setItem(seenStorageKey(), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — the badge just won't survive a reload */
  }
};

// Module-level so polling is shared: any number of components can ask to watch,
// only one interval ever runs.
let pollTimer = null;
let watchers = 0;

// Alerts already popped as a toast in this page session. Kept separate from the
// persisted "seen" set so dismissing a toast doesn't clear the bell badge, and
// re-opening the bell doesn't re-pop toasts.
const toasted = new Set();

export const useAlertsStore = create((set, get) => ({
  alerts: [],
  unseen: [],   // TRIGGERED alerts not yet acknowledged -> drives the bell badge
  toasts: [],   // alerts that tripped just now -> drives the popup queue
  isLoading: false,
  error: null,

  // `silent` skips the loading flag so background polls don't flash the
  // Alerts screen back into its skeleton state every minute.
  fetchAlerts: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const response = await API.get('/alerts');
      const alerts = response.data || [];
      const seen = loadSeen();
      const unseen = alerts.filter(
        (a) => a.status === 'TRIGGERED' && !seen.has(a.alert_id),
      );
      // Pop a toast only the first time we observe a given alert trip.
      const fresh = unseen.filter((a) => !toasted.has(a.alert_id));
      fresh.forEach((a) => toasted.add(a.alert_id));

      set((state) => ({
        alerts,
        unseen,
        toasts: fresh.length ? [...state.toasts, ...fresh] : state.toasts,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to load alerts.';
      set({ error: message, isLoading: false });
    }
  },

  // Start/stop the shared background poll. Ref-counted, so mounting the bell and
  // the toast stack together still results in a single interval.
  startWatching: () => {
    watchers += 1;
    get().fetchAlerts({ silent: true });
    if (!pollTimer) {
      pollTimer = setInterval(
        () => get().fetchAlerts({ silent: true }),
        POLL_INTERVAL_MS,
      );
    }
  },

  stopWatching: () => {
    watchers = Math.max(0, watchers - 1);
    if (watchers === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },

  // Acknowledge one triggered alert, or all of them when called with no id.
  markSeen: (alertId = null) => {
    const { unseen } = get();
    if (!unseen.length) return;
    const seen = loadSeen();
    const ids = alertId ? [alertId] : unseen.map((a) => a.alert_id);
    ids.forEach((id) => seen.add(id));
    saveSeen(seen);
    set({
      unseen: alertId ? unseen.filter((a) => a.alert_id !== alertId) : [],
    });
  },

  dismissToast: (alertId) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.alert_id !== alertId),
    })),

  createAlert: async (symbol, condition, targetPrice) => {
    try {
      await API.post('/alerts', {
        symbol,
        condition,
        target_price: targetPrice,
      });
      await get().fetchAlerts();
      return { success: true };
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail[0]?.msg || 'Invalid alert.'
        : detail || error.message || 'Failed to create alert.';
      return { success: false, error: message };
    }
  },

  deleteAlert: async (alertId) => {
    try {
      await API.delete(`/alerts/${alertId}`);
      await get().fetchAlerts();
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to delete alert.';
      return { success: false, error: message };
    }
  },
}));
