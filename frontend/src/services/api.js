import axios from 'axios';

// Backend origin, reused for building URLs to static assets (e.g. avatars).
export const API_ORIGIN = 'http://localhost:8000';

// Resolve a backend-relative path (like "/uploads/avatars/x.png") to a full URL.
export const assetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
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

export default API;