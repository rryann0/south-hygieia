import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

const api = {
  // Get all restrooms
  getRestrooms: async () => {
    const response = await axios.get(`${API_BASE_URL}/restrooms`);
    return response.data;
  },

  // Get all custodians
  getCustodians: async () => {
    const response = await axios.get(`${API_BASE_URL}/custodians`);
    return response.data;
  },

  // Get all checks
  getChecks: async () => {
    const response = await axios.get(`${API_BASE_URL}/checks`);
    return response.data;
  },

  // Log a check
  logCheck: async (custodianId, restroomId, notes = '') => {
    const response = await axios.post(`${API_BASE_URL}/checks`, {
      custodianId,
      restroomId,
      timestamp: new Date().toISOString(),
      notes
    });
    return response.data;
  },

  // Get all incidents
  getIncidents: async () => {
    const response = await axios.get(`${API_BASE_URL}/incidents`);
    return response.data;
  },

  // Report incident
  reportIncident: async (custodianId, restroomId, description, severity = 'medium') => {
    const response = await axios.post(`${API_BASE_URL}/incidents`, {
      custodianId,
      restroomId,
      description,
      severity,
      timestamp: new Date().toISOString()
    });
    return response.data;
  },

  // Resolve incident
  resolveIncident: async (incidentId) => {
    const response = await axios.post(`${API_BASE_URL}/incidents/resolve`, {
      incidentId
    });
    return response.data;
  }
};

export default api;

