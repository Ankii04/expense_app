import api from './api';

const authService = {
  register: async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    const { token, user } = response.data;
    if (token) {
      localStorage.setItem('spendify_token', token);
      localStorage.setItem('spendify_current_user', JSON.stringify(user));
    }
    return user;
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    if (token) {
      localStorage.setItem('spendify_token', token);
      localStorage.setItem('spendify_current_user', JSON.stringify(user));
    }
    return user;
  },

  logout: () => {
    localStorage.removeItem('spendify_token');
    localStorage.removeItem('spendify_current_user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('spendify_current_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (name) => {
    const response = await api.put('/auth/profile', { name });
    return response.data;
  },
};

export default authService;
