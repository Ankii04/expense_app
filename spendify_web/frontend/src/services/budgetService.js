import api from './api';

const budgetService = {
  getBudgets: async () => {
    const response = await api.get('/budgets');
    return response.data;
  },

  setBudget: async (category, amount) => {
    const response = await api.post('/budgets', { category, amount });
    return response.data;
  },
};

export default budgetService;
