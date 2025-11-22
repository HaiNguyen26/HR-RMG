import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor to suppress 404 errors for employee lookups
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't log 404 errors for employee lookups - these are expected when user ID doesn't match employee ID
    if (error.config?.url?.includes('/employees/') && error.response?.status === 404) {
      // Return a rejected promise but don't show console error
      // The calling code will handle it gracefully
      return Promise.reject(error);
    }
    // For other errors, let them propagate normally
    return Promise.reject(error);
  }
);

// Helper function to clean and validate ID
const cleanId = (id) => {
  if (typeof id === 'number') {
    if (isNaN(id) || id <= 0) {
      return null;
    }
    return id;
  }
  if (!id) {
    return null;
  }
  const str = String(id).trim();
  // Extract only numeric part (remove any non-numeric characters like colons, etc.)
  const numericMatch = str.match(/^\d+/);
  if (numericMatch) {
    return parseInt(numericMatch[0], 10);
  }
  return null;
};

// Employees API
export const employeesAPI = {
  getAll: () => api.get('/employees'),
  getById: (id) => {
    const cleanedId = cleanId(id);
    if (!cleanedId || isNaN(cleanedId)) {
      return Promise.reject(new Error(`Invalid employee ID: ${id}`));
    }
    return api.get(`/employees/${cleanedId}`);
  },
  create: (data) => api.post('/employees', data),
  update: (id, data) => {
    const cleanedId = cleanId(id);
    if (!cleanedId || isNaN(cleanedId)) {
      return Promise.reject(new Error(`Invalid employee ID: ${id}`));
    }
    return api.put(`/employees/${cleanedId}`, data);
  },
  delete: (id) => {
    const cleanedId = cleanId(id);
    if (!cleanedId || isNaN(cleanedId)) {
      return Promise.reject(new Error(`Invalid employee ID: ${id}`));
    }
    return api.delete(`/employees/${cleanedId}`);
  },
  bulkCreate: (employees) => api.post('/employees/bulk', { employees }),
};

// Equipment API
export const equipmentAPI = {
  getByEmployeeId: (employeeId) => {
    const cleanedId = cleanId(employeeId);
    if (!cleanedId || isNaN(cleanedId)) {
      console.error('[equipmentAPI.getByEmployeeId] Invalid employee ID:', employeeId);
      return Promise.reject(new Error(`Invalid employee ID: ${employeeId}`));
    }
    return api.get(`/equipment?employee_id=${cleanedId}`);
  },
  create: (data) => api.post('/equipment', data),
};

// Statistics API
export const statisticsAPI = {
  getStatistics: () => api.get('/statistics'),
};

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
};

// Requests API
export const requestsAPI = {
  getAll: (params) => api.get('/requests', { params }),
  getById: (id) => api.get(`/requests/${id}`),
  create: (data) => api.post('/requests', data),
  update: (id, data) => api.put(`/requests/${id}`, data),
  delete: (id) => api.delete(`/requests/${id}`),
  getStats: (department) => api.get(`/requests/stats/${department}`),
  updateItem: (requestId, itemId, data) => api.put(`/requests/${requestId}/items/${itemId}`, data),
};

// Leave Requests API
export const leaveRequestsAPI = {
  create: (data) => api.post('/leave-requests', data),
  getManagers: (params) => api.get('/leave-requests/managers', { params }),
  getAll: (params) => api.get('/leave-requests', { params }),
  decide: (id, data) => api.post(`/leave-requests/${id}/decision`, data),
  escalate: (id, data) => api.post(`/leave-requests/${id}/escalate`, data),
  processOverdue: () => api.post('/leave-requests/overdue/process'),
  remove: (id, data) => api.delete(`/leave-requests/${id}`, { data }),
};

export const overtimeRequestsAPI = {
  create: (data) => api.post('/overtime-requests', data),
  getAll: (params) => api.get('/overtime-requests', { params }),
  decide: (id, data) => api.post(`/overtime-requests/${id}/decision`, data),
  escalate: (id, data) => api.post(`/overtime-requests/${id}/escalate`, data),
  processOverdue: () => api.post('/overtime-requests/overdue/process'),
  remove: (id, data) => api.delete(`/overtime-requests/${id}`, { data }),
};

export const attendanceAdjustmentsAPI = {
  create: (data) => api.post('/attendance-adjustments', data),
  getAll: (params) => api.get('/attendance-adjustments', { params }),
  decide: (id, data) => api.post(`/attendance-adjustments/${id}/decision`, data),
  escalate: (id, data) => api.post(`/attendance-adjustments/${id}/escalate`, data),
  processOverdue: () => api.post('/attendance-adjustments/overdue/process'),
  remove: (id, data) => api.delete(`/attendance-adjustments/${id}`, { data }),
};

export const travelExpensesAPI = {
  create: (data) => api.post('/travel-expenses', data),
  getAll: (params) => api.get('/travel-expenses', { params }),
  getById: (id) => api.get(`/travel-expenses/${id}`),
  decide: (id, data) => api.post(`/travel-expenses/${id}/decision`, data),
};

// Candidates API
export const candidatesAPI = {
  getAll: (params) => api.get('/candidates', { params }),
  create: (formData) => api.post('/candidates', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
  updateStatus: (id, data) => api.put(`/candidates/${id}/status`, data),
  updateNotes: (id, data) => api.put(`/candidates/${id}/notes`, data),
  delete: (id) => api.delete(`/candidates/${id}`),
  getManagers: () => api.get('/candidates/managers'),
  createInterviewRequest: (candidateId, data) => api.post(`/candidates/${candidateId}/interview-request`, data),
  getInterviewRequests: (params) => api.get('/candidates/interview-requests', { params }),
  updateInterviewRequestStatus: (id, data) => api.put(`/candidates/interview-requests/${id}/status`, data),
  submitInterviewEvaluation: (id, data) => api.put(`/candidates/interview-requests/${id}/evaluation`, data),
  generateJobOfferPDF: (id, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/candidates/${id}/job-offer-pdf${queryString ? `?${queryString}` : ''}`;
    return api.get(url, { responseType: 'blob' });
  },
  generateJobOfferPDFFromForm: (data) => {
    return api.post('/candidates/generate-job-offer-pdf', data, { responseType: 'blob' });
  },
  // Recruitment Requests API
  createRecruitmentRequest: (data) => api.post('/candidates/recruitment-requests', data),
  getAllRecruitmentRequests: (params) => api.get('/candidates/recruitment-requests', { params }),
  getRecruitmentRequestById: (id) => api.get(`/candidates/recruitment-requests/${id}`),
  updateRecruitmentRequestStatus: (id, data) => api.put(`/candidates/recruitment-requests/${id}/status`, data),
};

// Notification system removed

export default api;
