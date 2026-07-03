import axios from 'axios';
const BASE = process.env.REACT_APP_API_URL || '/api';
const api = axios.create({ baseURL: BASE });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('jh_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('jh_token');
    localStorage.removeItem('jh_user');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});
export const authAPI = {
  register: d => api.post('/auth/register', d),
  login: d => api.post('/auth/login', d),
  me: () => api.get('/auth/me'),
  updateProfile: d => api.patch('/auth/me', d),
  changePassword: d => api.patch('/auth/password', d),
  forgotPassword: d => api.post('/auth/forgot-password', d),
  resetPassword: (token, d) => api.post(`/auth/reset-password/${token}`, d),
  getApiKeys: () => api.get('/auth/api-keys'),
  createApiKey: d => api.post('/auth/api-keys', d),
  deleteApiKey: name => api.delete(`/auth/api-keys/${name}`)
};
export const servicesAPI = {
  list: () => api.get('/services'),
  get: id => api.get(`/services/${id}`),
  create: d => api.post('/services', d),
  update: (id, d) => api.patch(`/services/${id}`, d),
  delete: id => api.delete(`/services/${id}`),
  upload: (id, fd) => api.post(`/services/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getDeployments: id => api.get(`/services/${id}/deployments`),
  getMetrics: (id, h) => api.get(`/services/${id}/metrics?hours=${h||1}`),
  suspend: id => api.post(`/services/${id}/suspend`),
  resume: id => api.post(`/services/${id}/resume`),
  restart: id => api.post(`/services/${id}/restart`),
  rollback: (id, dId) => api.post(`/services/${id}/rollback/${dId}`)
};
export const deploysAPI = {
  deploy: (sId, d) => api.post(`/deployments/${sId}/deploy`, d),
  getLogs: id => api.get(`/deployments/${id}/logs`),
  cancel: id => api.post(`/deployments/${id}/cancel`)
};
export const dbAPI = {
  list: () => api.get('/databases'),
  get: id => api.get(`/databases/${id}`),
  create: d => api.post('/databases', d),
  delete: id => api.delete(`/databases/${id}`)
};
export const egAPI = {
  list: () => api.get('/envgroups'),
  get: id => api.get(`/envgroups/${id}`),
  create: d => api.post('/envgroups', d),
  update: (id, d) => api.patch(`/envgroups/${id}`, d),
  link: (id, sId) => api.post(`/envgroups/${id}/link/${sId}`),
  delete: id => api.delete(`/envgroups/${id}`)
};
export const domainsAPI = {
  list: () => api.get('/domains'),
  add: d => api.post('/domains', d),
  verify: id => api.post(`/domains/${id}/verify`),
  assign: (id, d) => api.patch(`/domains/${id}/assign`, d),
  delete: id => api.delete(`/domains/${id}`)
};
export const teamsAPI = {
  list: () => api.get('/teams'),
  create: d => api.post('/teams', d),
  invite: (id, d) => api.post(`/teams/${id}/invite`, d),
  removeMember: (tId, uId) => api.delete(`/teams/${tId}/members/${uId}`)
};
export const notifAPI = {
  list: () => api.get('/notifications'),
  readAll: () => api.patch('/notifications/read-all'),
  read: id => api.patch(`/notifications/${id}/read`),
  delete: id => api.delete(`/notifications/${id}`)
};
export const activityAPI = { list: () => api.get('/activity') };
export const metricsAPI = { system: () => api.get('/metrics/system') };
export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  users: () => api.get('/admin/users'),
  updateUser: (id, d) => api.patch(`/admin/users/${id}`, d),
  deleteUser: id => api.delete(`/admin/users/${id}`),
  services: () => api.get('/admin/services'),
  restartService: id => api.post(`/admin/services/${id}/restart`),
  deleteService: id => api.delete(`/admin/services/${id}`)
};
export default api;
