import axios from 'axios';

// Backend origin, reused for building URLs to static assets (e.g. avatars).
export const API_ORIGIN = 'http://localhost:8000';

// Resolve a backend-relative path (like "/uploads/avatars/x.png") to a full URL.
export const assetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
};

// Decode a JWT payload (no signature check) to read standard claims like `exp`.
export const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

// True when the token is missing, malformed, or its `exp` (seconds) has passed.
export const isTokenExpired = (token) => {
  if (!token) return true;
  const payload = decodeToken(token);
  if (!payload) return true;
  if (!payload.exp) return false; // no exp claim → treat as non-expiring
  return payload.exp * 1000 <= Date.now();
};

// Clear the stored session and, unless we're already on a public page, send the
// user back to the login screen. A hard redirect guarantees the Zustand store
// re-initialises from the now-empty localStorage (fully logged out).
export const forceLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  const publicPaths = ['/login', '/register', '/welcome'];
  if (!publicPaths.includes(window.location.pathname)) {
    window.location.replace('/login');
  }
};

// Create an Axios instance pointing to your backend address
const API = axios.create({
  baseURL: `${API_ORIGIN}/`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatically attach JWT token to every request header if it exists
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: an expired or invalid session (401) auto-logs-out the
// user. We skip login/register calls so a bad-credentials attempt shows its own
// error instead of bouncing to the login redirect.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register');
    if (status === 401 && !isAuthCall) {
      forceLogout();
    }
    return Promise.reject(error);
  }
);

export default API;