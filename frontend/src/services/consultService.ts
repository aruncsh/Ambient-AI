import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/v1/consults`;
const TELE_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/v1/teleconsult`;
const RESOURCE_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/v1/resource`;

export const consultService = {
  validateToken: async (token: string) => {
    const response = await axios.get(`${TELE_BASE_URL}/token-validate`, { params: { token } });
    return response.data;
  },

  getSummary: async (token: string) => {
    const response = await axios.get(`${TELE_BASE_URL}/summary`, { params: { token } });
    return response.data;
  },

  list: async (filters: any) => {
    const response = await axios.get(`${RESOURCE_BASE_URL}/consults`, { params: filters });
    return response.data;
  },

  create: async (data: any) => {
    const response = await axios.post(`${RESOURCE_BASE_URL}/consults`, data);
    return response.data;
  },

  fetchConsult: async (id: string, role: string, participantId: string) => {
    const response = await axios.get(`${API_BASE_URL}/${id}/${role}/${participantId}`);
    return response.data;
  },

  startConsult: async (id: string, role: string, participantId: string) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/${role}/${participantId}/start`);
    return response.data;
  },

  endConsult: async (id: string, role: string, participantId: string, notes?: string) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/${role}/${participantId}/end`, { consult_notes: notes });
    return response.data;
  },

  notifyEvent: async (id: string, role: string, participantId: string, event: string) => {
    const response = await axios.post(`${API_BASE_URL}/${id}/${role}/${participantId}/event`, { event });
    return response.data;
  },

  inviteGuests: async (id: string, role: string, participantId: string, invites: any[]) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/${role}/${participantId}/invite`, { invites });
    return response.data;
  },

  switchProvider: async (id: string, role: string, participantId: string, provider: string) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/${role}/${participantId}/switch`, { virtual_service_provider: provider });
    return response.data;
  }
};
