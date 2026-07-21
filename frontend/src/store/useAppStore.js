// useAppStore.js
import { create } from 'zustand';
import API, { isTokenExpired } from '../services/api';

// Resolve the session from localStorage at startup: an expired (or missing)
// token is treated as no session at all, so the app never renders the
// authenticated shell with a dead token.
const storedToken = localStorage.getItem('token');
const validToken = storedToken && !isTokenExpired(storedToken) ? storedToken : null;
if (storedToken && !validToken) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export const useAppStore = create((set, get) => ({
  // --- Global Asset & View State ---
  selectedSymbol: 'NABIL',
  marketTickers: [],
  isLoading: false,

  // Unified Portfolio State matching your backend API payload
  portfolio: { 
    balance: 0, 
    summary: null, // Stores { total_invested_value, total_current_value, total_profit_loss, total_profit_loss_percentage }
    holdings: []   // Stores array of individual active positions
  },

  // --- Authentication State ---
  // Restore the session from localStorage (survives refresh), but only if the
  // stored token is still valid — an expired token starts the user logged out.
  user: validToken ? JSON.parse(localStorage.getItem('user')) || null : null,
  token: validToken,
  isAuthenticated: !!validToken,
  authError: null,

  // --- Authentication Actions ---

  // Action: Log in the user
  login: async (email, password) => {
    set({ isLoading: true, authError: null });
    try {
      // 1. Format the payload as URL-encoded form data (required by OAuth2PasswordRequestForm)
      const formData = new URLSearchParams();
      formData.append('username', email); // Your backend checks User.email against user.username
      formData.append('password', password);

      // 2. Send POST request with the URL-encoded content header
      const response = await API.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // 3. Parse access_token, email, and any name fields returned by the backend
      const { access_token, email: userEmail, full_name, name } = response.data;

      // Fallback name parsing if backend doesn't return full_name in the token response
      const displayName = full_name || name || userEmail.split('@')[0];
      const userData = { email: userEmail, name: displayName };

      // 4. Save token and user details in browser local storage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      set({ 
        token: access_token, 
        user: userData, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return true;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Login failed. Please check your credentials.";
      set({ authError: errorMsg, isLoading: false });
      return false;
    }
  },

  // Action: Register a new user (Standard JSON payload)
  registerUser: async (fullName, email, password) => {
    set({ isLoading: true, authError: null });
    try {
      // 1. Prepare JSON payload matching UserCreate schema
      const payload = {
        full_name: fullName, 
        email: email,
        password: password
      };

      // 2. POST request sending JSON
      const response = await API.post('/auth/register', payload);

      // 3. If registration succeeds, automatically log the user in to retrieve the access token
      if (response.status === 200 || response.status === 201) {
        return await get().login(email, password);
      }
      return false;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Registration failed. Please check your inputs.";
      set({ authError: errorMsg, isLoading: false });
      return false;
    }
  },

  // Action: Log out
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Clean up user session details
    set({ token: null, user: null, isAuthenticated: false, authError: null });
  },

  // Action: Fetch the full profile (name, email, role, avatar) from the backend
  fetchProfile: async () => {
    try {
      const response = await API.get('/users/me');
      const currentSessionUser = JSON.parse(localStorage.getItem('user')) || {};
      const updatedUser = {
        ...currentSessionUser,
        email: response.data.email ?? currentSessionUser.email,
        name: response.data.full_name || currentSessionUser.name,
        full_name: response.data.full_name,
        role: response.data.role,
        avatar_url: response.data.avatar_url || null,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return updatedUser;
    } catch (error) {
      console.error('Failed to fetch profile:', error.response || error);
      return null;
    }
  },

  // Action: Update editable profile fields (currently full name)
  updateProfile: async (fullName) => {
    try {
      const response = await API.patch('/users/me', { full_name: fullName });
      const profile = response.data.profile || {};
      const currentSessionUser = JSON.parse(localStorage.getItem('user')) || {};
      const updatedUser = {
        ...currentSessionUser,
        name: profile.full_name || fullName,
        full_name: profile.full_name || fullName,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to update profile.';
      return { success: false, error: message };
    }
  },

  // Action: Change the account password
  changePassword: async (currentPassword, newPassword) => {
    try {
      await API.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return { success: true };
    } catch (error) {
      const detail = error.response?.data?.detail;
      // Pydantic validation errors arrive as an array
      const message = Array.isArray(detail)
        ? detail[0]?.msg || 'Invalid password.'
        : detail || error.message || 'Failed to change password.';
      return { success: false, error: message };
    }
  },

  // Action: Upload a new profile photo
  uploadAvatar: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await API.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const avatarUrl = response.data.avatar_url;
      const currentSessionUser = JSON.parse(localStorage.getItem('user')) || {};
      const updatedUser = { ...currentSessionUser, avatar_url: avatarUrl };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return { success: true, avatar_url: avatarUrl };
    } catch (error) {
      const message =
        error.response?.data?.detail || error.message || 'Failed to upload photo.';
      return { success: false, error: message };
    }
  },

  // Action: Fetch wallet balance and user profile name securely
  fetchWallet: async () => {
    try {
      // 1. Get the token from the store state (fallback to localStorage if state is empty)
      const token = get().token || localStorage.getItem('token');
      if (!token) {
        console.warn("fetchWallet skipped: No auth token found.");
        return;
      }

      // 2. Send GET request with the Authorization header
      const response = await API.get('/users/me/wallet', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log("wallet data:", response.data);

      // 3. Safely destructure all expected variables from response.data (including username variations)
      const { 
        balance, 
        currency, 
        user_name, 
        username, 
        full_name, 
        name 
      } = response.data || {};

      // 4. Resolve the username and update the localStorage session
      const currentSessionUser = JSON.parse(localStorage.getItem('user')) || {};
      const resolvedName = user_name || username || full_name || name || currentSessionUser.name || "User";
      
      const updatedUser = { 
        ...currentSessionUser, 
        name: resolvedName 
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log("Wallet balance parsed:", balance);

      // 5. Save the updated balance and user details to the store state
      set((state) => ({
        portfolio: { 
          ...state.portfolio, 
          balance: parseFloat(balance || 0) 
        },
        user: updatedUser
      }));
    } catch (error) {
      console.error("Failed to fetch wallet info:", error.response || error);
    }
  },

  // Action: Load paper funds into the wallet, then refresh the balance
  depositFunds: async (amount) => {
    try {
      const value = Number(amount);
      if (!value || value <= 0) {
        return { success: false, error: 'Enter an amount greater than zero.' };
      }
      const response = await API.post('/users/me/wallet/deposit', { amount: value });
      // Reflect the new balance immediately from the response, then re-sync.
      set((state) => ({
        portfolio: {
          ...state.portfolio,
          balance: parseFloat(response.data?.balance ?? state.portfolio.balance),
        },
      }));
      await get().fetchWallet();
      return { success: true, balance: response.data?.balance };
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail[0]?.msg || 'Deposit failed.'
        : detail || error.message || 'Deposit failed.';
      return { success: false, error: message };
    }
  },

  // Action: Fetch portfolio summary and holdings securely from the backend
  fetchPortfolio: async () => {
    set({ isLoading: true });
    try {
      const token = get().token || localStorage.getItem('token');
      if (!token) {
        console.warn("fetchPortfolio skipped: No auth token found.");
        return;
      }

      const response = await API.get('/users/me/portfolio', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log("Portfolio response:", response.data);

      set((state) => ({
        portfolio: {
          ...state.portfolio,
          summary: response.data.summary || null,
          holdings: response.data.holdings || []
        },
        isLoading: false
      }));
    } catch (error) {
      console.error("Failed to fetch portfolio:", error.response || error);
      set({ isLoading: false });
    }
  },

  // --- Existing Actions ---
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  // Market state for the Market screen
  marketLoading: false,
  marketError: null,
  marketUpdatedAt: null,

  // Action: Fetch the full list of tradable stocks (Market screen)
  fetchTickers: async () => {
    set({ marketLoading: true, marketError: null });
    try {
      const response = await API.get('/stocks');
      set({
        marketTickers: response.data || [],
        marketLoading: false,
        marketUpdatedAt: new Date(),
      });
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        'Failed to load market data.';
      set({ marketError: message, marketLoading: false });
    }
  },
}));