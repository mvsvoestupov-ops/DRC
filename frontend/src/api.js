import axios from 'axios';

// Для сервера используем '/api', для локальной разработки используем 'http://localhost:10000'
const API = axios.create({
  baseURL: 'http://localhost:10000',
  timeout: 600000
});

API.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/upload', formData);
};

export const getStandards = () => API.get('/standards');
export const getStandard = (regNumber) => API.get(`/standards/${regNumber}`);
export const fetchBulkRegistry = () => API.post('/fetch-registry-bulk');
export const getEnrichedStandards = () => API.get('/enriched-standards');
export const getEnrichedStandard = (regNumber) => API.get(`/enriched-standards/${regNumber}`);
export const getLoadProgress = () => API.get('/progress/load');
export const getEnrichProgress = () => API.get('/progress/enrich');
export const runEnrichment = (regNumber) => {
  const params = regNumber ? `?reg_number=${regNumber}` : '';
  return API.post(`/run-enrichment${params}`);
};
export const createCompetence = (data) => API.post('/competences', data);
export const getCompetences = () => API.get('/competences');
export const getCompetence = (id) => API.get(`/competences/${id}`);
export const updateCompetence = (id, data) => API.put(`/competences/${id}`, data);
export const deleteCompetence = (id) => API.delete(`/competences/${id}`);
export const getCompetenceStats = () => API.get('/competences/stats');
export const getQualifications = () => API.get('/qualifications');
export const getQualification = (id) => API.get(`/qualifications/${id}`);
export const searchStandards = (query) => {
  return API.get('/standards/search', { params: { q: query, limit: 20 } });
};
export const getQualificationsByStandard = (standardId) => API.get(`/qualifications/by-standard/${standardId}`);
export const calculateCoverage = (standardId, selectedTfCodes) => {
  return API.post('/competence/coverage', {
    standard_id: standardId,
    selected_tf_codes: selectedTfCodes
  });
};

// ========== ДОБАВЛЕНО ==========
export const getRegistrations = () => API.get('/registrations');
