import api from './api';

const recurringService = {
  getRecurring: async () => {
    const response = await api.get('/recurring');
    return response.data;
  },

  addRecurring: async (recurringData) => {
    const response = await api.post('/recurring', recurringData);
    return response.data;
  },

  updateRecurring: async (id, recurringData) => {
    const response = await api.put(`/recurring/${id}`, recurringData);
    return response.data;
  },

  deleteRecurring: async (id) => {
    const response = await api.delete(`/recurring/${id}`);
    return response.data;
  },
};

export default recurringService;
