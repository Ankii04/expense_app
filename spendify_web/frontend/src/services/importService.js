import api from './api';

const importService = {
  uploadCSV: async (groupId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/groups/${groupId}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getReport: async (groupId, importId) => {
    const response = await api.get(`/groups/${groupId}/import/${importId}`);
    return response.data;
  },

  approveAnomaly: async (groupId, importId, rowNumber) => {
    const response = await api.post(`/groups/${groupId}/import/${importId}/approve`, { rowNumber });
    return response.data;
  },
};

export default importService;
