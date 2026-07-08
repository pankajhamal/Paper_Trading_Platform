// src/store/useHistoryStore.js
import { create } from 'zustand';
import API from '../services/api';

export const useHistoryStore = create((set) => ({
  transactions: [],
  isLoading: false,
  error: null,

  // Fetch the user's transaction ledger (most recent first)
  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/users/me/transactions');
      set({ transactions: response.data || [], isLoading: false });
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        'Failed to load transaction history.';
      set({ error: message, isLoading: false });
    }
  },
}));
