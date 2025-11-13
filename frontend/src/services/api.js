import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Employees API
export const employeesAPI = {
  getAll: () => api.get('/employees'),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  bulkCreate: (employees) => api.post('/employees/bulk', { employees }),
};

// Equipment API
export const equipmentAPI = {
  getByEmployeeId: (employeeId) => api.get(`/equipment?employee_id=${employeeId}`),
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

// Notifications API
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: (userId) => api.get(`/notifications/unread-count/${userId}`),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: (userId) => api.put(`/notifications/read-all/${userId}`),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;
