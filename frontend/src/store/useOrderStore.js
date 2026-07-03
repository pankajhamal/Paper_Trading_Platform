// src/store/orderStore.js
import { create } from 'zustand';
import API from '../services/api';

export const useOrderStore = create((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  // Fetch complete order history from database
  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/users/orders');
      
      // Axios stores the parsed JSON response inside the 'data' property
      set({ orders: response.data, isLoading: false });
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch order history.';
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Place a buy order (Market or Limit)
  placeBuyOrder: async (symbol, quantity, orderType, limitPrice) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post('/trade/buy', {
        symbol,
        quantity,
        order_type: orderType,
        limit_price: limitPrice,
      });

      // Re-fetch orders list automatically to sync database state
      await get().fetchOrders();
      set({ isLoading: false });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to place buy order.';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  // Place a sell order (Market or Limit)
  placeSellOrder: async (symbol, quantity, orderType, limitPrice) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post('/trade/sell', {
        symbol,
        quantity,
        order_type: orderType,
        limit_price: limitPrice,
      });

      // Re-fetch orders list automatically to sync database state
      await get().fetchOrders();
      set({ isLoading: false });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to place sell order.';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },
}));