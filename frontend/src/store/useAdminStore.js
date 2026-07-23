// src/store/useAdminStore.js
import { create } from 'zustand';
import API from '../services/api';

const errMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return detail || error.message || fallback;
};

export const useAdminStore = create((set, get) => ({
  overview: null,
  users: [],
  withdrawals: [],
  fundRequests: [],
  loading: false,
  error: null,

  // --- Overview ---
  fetchOverview: async () => {
    try {
      const { data } = await API.get('/admin/overview');
      set({ overview: data });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load overview.') });
    }
  },

  // --- Users ---
  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await API.get('/admin/users');
      set({ users: data || [], loading: false });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load users.'), loading: false });
    }
  },

  disableUser: async (userId) => {
    try {
      await API.delete(`/admin/users/${userId}`);
      await get().fetchUsers();
      return { success: true };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Failed to disable user.') };
    }
  },

  activateUser: async (userId) => {
    try {
      await API.post(`/admin/users/${userId}/activate`);
      await get().fetchUsers();
      return { success: true };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Failed to re-enable user.') };
    }
  },

  // --- Withdrawals ---
  fetchWithdrawals: async (statusFilter) => {
    set({ loading: true, error: null });
    try {
      const params = statusFilter ? { status_filter: statusFilter } : {};
      const { data } = await API.get('/admin/withdrawals', { params });
      set({ withdrawals: data || [], loading: false });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load withdrawals.'), loading: false });
    }
  },

  approveWithdrawal: async (requestId, note) => {
    try {
      await API.post(`/admin/withdrawals/${requestId}/approve`, { note: note || null });
      return { success: true };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Failed to approve request.') };
    }
  },

  rejectWithdrawal: async (requestId, note) => {
    try {
      await API.post(`/admin/withdrawals/${requestId}/reject`, { note: note || null });
      return { success: true };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Failed to reject request.') };
    }
  },

  // --- Fund (money) requests ---
  fetchFundRequests: async (statusFilter) => {
    set({ loading: true, error: null });
    try {
      const params = statusFilter ? { status_filter: statusFilter } : {};
      const { data } = await API.get('/admin/fund-requests', { params });
      set({ fundRequests: data || [], loading: false });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load fund requests.'), loading: false });
    }
  },

  approveFundRequest: async (requestId, note) => {
    try {
      await API.post(`/admin/fund-requests/${requestId}/approve`, { note: note || null });
      return { success: true };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Failed to approve request.') };
    }
  },

  rejectFundRequest: async (requestId, note) => {
    try {
      await API.post(`/admin/fund-requests/${requestId}/reject`, { note: note || null });
      return { success: true };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Failed to reject request.') };
    }
  },
}));
