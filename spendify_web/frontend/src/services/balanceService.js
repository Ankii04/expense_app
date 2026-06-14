import api from './api';

const balanceService = {
  getBalances: async (groupId) => {
    const response = await api.get(`/groups/${groupId}/balances`);
    return response.data;
  },
};

export default balanceService;
