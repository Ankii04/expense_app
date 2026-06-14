import api from './api';

const expenseService = {
  getPersonalExpenses: async () => {
    const response = await api.get('/expenses');
    return response.data;
  },

  addPersonalExpense: async (expenseData) => {
    const response = await api.post('/expenses', expenseData);
    return response.data;
  },

  updateExpense: async (id, expenseData) => {
    const response = await api.put(`/expenses/${id}`, expenseData);
    return response.data;
  },

  deleteExpense: async (id) => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },

  getGroupExpenses: async (groupId) => {
    const response = await api.get(`/groups/${groupId}/expenses`);
    return response.data;
  },

  addGroupExpense: async (groupId, expenseData) => {
    const response = await api.post(`/groups/${groupId}/expenses`, expenseData);
    return response.data;
  },
};

export default expenseService;
