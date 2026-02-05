import axios from 'axios';

// Use VITE_API_URL when set (e.g. on a VM: http://your-vm-ip:3000/api or http://your-vm-host:3000/api).
// Otherwise: in dev use localhost:3000; in production build use relative /api (same origin, e.g. behind Nginx).
const API_BASE_URL =
  import.meta.env.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '') // strip trailing slash
    : import.meta.env.DEV
      ? 'http://localhost:3000/api'
      : '/api';

// Configure axios to send credentials (cookies) with all requests
axios.defaults.withCredentials = true;

// Add request timeout
axios.defaults.timeout = 10000; // 10 seconds

// Add response interceptor for better error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout - server is taking too long to respond';
    } else if (error.code === 'ERR_NETWORK') {
      error.message = 'Network error - please check your connection';
    } else if (!error.response) {
      error.message = 'Server unavailable - please try again later';
    }
    return Promise.reject(error);
  }
);

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
      severity
    });
    return response.data;
  },

  // Resolve incident
  resolveIncident: async (incidentId) => {
    const response = await axios.post(`${API_BASE_URL}/incidents/resolve`, {
      incidentId
    }, {
      withCredentials: true
    });
    return response.data;
  },

  // Admin authentication
  checkAdminStatus: async () => {
    const response = await axios.get(`${API_BASE_URL}/admin/status`, {
      withCredentials: true
    });
    return response.data;
  },

  adminLogin: async (password) => {
    const response = await axios.post(`${API_BASE_URL}/admin/login`, {
      password
    }, {
      withCredentials: true
    });
    return response.data;
  },

  adminLogout: async () => {
    const response = await axios.post(`${API_BASE_URL}/admin/logout`, {}, {
      withCredentials: true
    });
    return response.data;
  },

  // User authentication
  checkAuthStatus: async () => {
    const response = await axios.get(`${API_BASE_URL}/auth/status`, {
      withCredentials: true
    });
    return response.data;
  },

  userLogin: async (password) => {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      password
    }, {
      withCredentials: true
    });
    return response.data;
  },

  userLogout: async () => {
    const response = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
      withCredentials: true
    });
    return response.data;
  }
};

export default api;

