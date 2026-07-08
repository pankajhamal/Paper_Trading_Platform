// src/store/useWatchlistStore.js
import { create } from 'zustand';
import API from '../services/api';

export const useWatchlistStore = create((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  // Fetch the user's watchlist with live price data
  fetchWatchlist: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/watchlist');
      set({ items: response.data || [], isLoading: false });
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to load watchlist.';
      set({ error: message, isLoading: false });
    }
  },

  // Add a stock (by symbol) to the watchlist
  addToWatchlist: async (symbol) => {
    try {
      await API.post('/watchlist', { symbol });
      await get().fetchWatchlist();
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to add stock.';
      return { success: false, error: message };
    }
  },

  // Remove a stock (by symbol) from the watchlist
  removeFromWatchlist: async (symbol) => {
    try {
      await API.delete(`/watchlist/${symbol}`);
      await get().fetchWatchlist();
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to remove stock.';
      return { success: false, error: message };
    }
  },
}));
