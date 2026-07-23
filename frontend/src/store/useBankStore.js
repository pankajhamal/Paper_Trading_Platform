// src/store/useBankStore.js
import { create } from 'zustand';
import API from '../services/api';
import { useAppStore } from './useAppStore';

const errMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return detail || error.message || fallback;
};

export const useBankStore = create((set, get) => ({
  bank: { balance: 0, bank_name: '' },
  requests: [],
  withdrawals: [],
  isLoading: false,
  error: null,

  // Fetch the user's e-bank balance + last-used bank name.
  fetchBank: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await API.get('/users/me/bank');
      set({
        bank: { balance: parseFloat(data.balance ?? 0), bank_name: data.bank_name || '' },
        isLoading: false,
      });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load bank account.'), isLoading: false });
    }
  },

  // Fetch the user's own fund requests.
  fetchRequests: async () => {
    try {
      const { data } = await API.get('/users/me/bank/requests');
      set({ requests: data || [] });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load requests.') });
    }
  },

  // Move money from the e-bank into the trading wallet (gated by bank balance).
  loadToWallet: async (amount, bankName) => {
    try {
      const value = Number(amount);
      if (!value || value <= 0) {
        return { success: false, error: 'Enter an amount greater than zero.' };
      }
      const { data } = await API.post('/users/me/bank/load', {
        amount: value,
        bank_name: bankName || null,
      });
      set((state) => ({
        bank: {
          balance: parseFloat(data.bank_balance ?? state.bank.balance),
          bank_name: data.bank_name || state.bank.bank_name,
        },
      }));
      // The trading wallet balance lives in useAppStore — re-sync it.
      await useAppStore.getState().fetchWallet();
      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Load failed.') };
    }
  },

  // Request more paper money (subject to admin approval).
  requestFunds: async (amount, note) => {
    try {
      const value = Number(amount);
      if (!value || value <= 0) {
        return { success: false, error: 'Enter an amount greater than zero.' };
      }
      const { data } = await API.post('/users/me/bank/request', {
        amount: value,
        note: note || null,
      });
      await get().fetchRequests();
      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Request failed.') };
    }
  },

  // Fetch the user's own withdrawal (wallet -> bank) requests.
  fetchWithdrawals: async () => {
    try {
      const { data } = await API.get('/users/me/withdrawals');
      set({ withdrawals: data || [] });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to load withdrawals.') });
    }
  },

  // Request a withdrawal from the wallet to the bank (subject to admin approval).
  // Nothing is debited now — approval moves the money.
  requestWithdrawal: async (amount) => {
    try {
      const value = Number(amount);
      if (!value || value <= 0) {
        return { success: false, error: 'Enter an amount greater than zero.' };
      }
      const { data } = await API.post('/users/me/wallet/withdraw', { amount: value });
      await get().fetchWithdrawals();
      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: errMessage(error, 'Withdrawal request failed.') };
    }
  },
}));
