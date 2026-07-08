// src/store/useAlertsStore.js
import { create } from 'zustand';
import API from '../services/api';

export const useAlertsStore = create((set, get) => ({
  alerts: [],
  isLoading: false,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/alerts');
      set({ alerts: response.data || [], isLoading: false });
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to load alerts.';
      set({ error: message, isLoading: false });
    }
  },

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
