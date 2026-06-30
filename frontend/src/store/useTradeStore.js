// store/useTradeStore.js
import { create } from 'zustand';
import API from '../services/api';
import { useAppStore } from './useAppStore'; 

export const useTradeStore = create((set, get) => ({
  isLoading: false,
  tradeError: null,

  // Action: Buy Stock (expects symbol and quantity)
  buyStock: async (symbol, quantity) => {
    set({ isLoading: true, tradeError: null });
    try {
      const token = useAppStore.getState().token || localStorage.getItem('token');
      
      if (!token) {
        throw new Error("Authorization token not found. Please log in again.");
      }

      const payload = {
        symbol: symbol.toUpperCase(),
        quantity: parseInt(quantity, 10),
      };

      const response = await API.post('/trade/buy', payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Automatically refresh wallet balance and portfolio holdings in the App Store
      await useAppStore.getState().fetchWallet();
      await useAppStore.getState().fetchPortfolio();

      set({ isLoading: false });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "Buy transaction failed.";
      set({ isLoading: false, tradeError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  // Action: Sell Stock (expects symbol and quantity)
  sellStock: async (symbol, quantity) => {
    set({ isLoading: true, tradeError: null });
    try {
      const token = useAppStore.getState().token || localStorage.getItem('token');
      
      if (!token) {
        throw new Error("Authorization token not found. Please log in again.");
      }

      const payload = {
        symbol: symbol.toUpperCase(),
        quantity: parseInt(quantity, 10),
      };

      const response = await API.post('/trade/sell', payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Automatically refresh wallet balance and portfolio holdings in the App Store
      await useAppStore.getState().fetchWallet();
      await useAppStore.getState().fetchPortfolio();

      set({ isLoading: false });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "Sell transaction failed.";
      set({ isLoading: false, tradeError: errorMsg });
      return { success: false, error: errorMsg };
    }
  }
}));