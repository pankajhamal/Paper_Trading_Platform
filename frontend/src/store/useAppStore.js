// useAppStore.js
import { create } from 'zustand';
import API from '../services/api';

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
  // Load both user and token from localStorage to survive page refreshes
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
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
  fetchTickers: async () => { /* ... existing fetch code ... */ }
}));