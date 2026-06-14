import api from './api';

const groupService = {
  getGroups: async () => {
    const response = await api.get('/groups');
    return response.data;
  },

  getGroup: async (id) => {
    const response = await api.get(`/groups/${id}`);
    return response.data;
  },

  addGroup: async (groupData) => {
    const response = await api.post('/groups', groupData);
    return response.data;
  },

  addMember: async (groupId, memberData) => {
    const response = await api.post(`/groups/${groupId}/members`, memberData);
    return response.data;
  },

  updateMember: async (groupId, userId, memberData) => {
    const response = await api.put(`/groups/${groupId}/members/${userId}`, memberData);
    return response.data;
  },

  deleteGroup: async (id) => {
    const response = await api.delete(`/groups/${id}`);
    return response.data;
  },
};

export default groupService;
