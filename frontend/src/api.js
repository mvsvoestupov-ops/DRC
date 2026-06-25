import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 600000 // 10 минут
});

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/upload', formData);
};

export const getStandards = () => API.get('/standards');

export const getStandard = (regNumber) => API.get(`/standards/${regNumber}`);

export const fetchBulkRegistry = () => API.post('/fetch-registry-bulk');

// Новые методы для обогащённых данных
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

export const getCompetenceStats = () => API.get('/competences/stats');

export const getQualifications = () => API.get('/qualifications');

export const getQualification = (id) => API.get(`/qualifications/${id}`);