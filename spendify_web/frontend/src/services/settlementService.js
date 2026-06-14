import api from './api';

const settlementService = {
  getSettlements: async (groupId) => {
    const response = await api.get(`/groups/${groupId}/settlements`);
    return response.data;
  },

  addSettlement: async (groupId, settlementData) => {
    const response = await api.post(`/groups/${groupId}/settlements`, settlementData);
    return response.data;
  },
};

export default settlementService;
