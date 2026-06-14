import api from './api';

const lendService = {
  getLends: async () => {
    const response = await api.get('/lends');
    return response.data;
  },

  addLend: async (lendData) => {
    const response = await api.post('/lends', lendData);
    return response.data;
  },

  updateLend: async (id, lendData) => {
    const response = await api.put(`/lends/${id}`, lendData);
    return response.data;
  },

  deleteLend: async (id) => {
    const response = await api.delete(`/lends/${id}`);
    return response.data;
  },
};

export default lendService;
