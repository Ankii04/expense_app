import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 
                (typeof process !== 'undefined' ? process.env.REACT_APP_API_URL : '') || 
                'http://localhost:5000';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('spendify_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch 401 Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('⚠️ Unauthorized request detected. Clearing session.');
      localStorage.removeItem('spendify_token');
      localStorage.removeItem('spendify_current_user');
      // Reload page to force redirection to login screen
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
