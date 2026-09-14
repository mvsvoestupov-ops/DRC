const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    };

    if (body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body instanceof URLSearchParams ? body.toString() : body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail || `HTTP error ${response.status}`;
      const error = new Error(detail);
      (error as any).status = response.status;
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.dispatchEvent(new Event('auth:logout'));
      }
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return response.json();
  }

  get = <T>(endpoint: string, options?: RequestInit) =>
    this.request<T>('GET', endpoint, undefined, options);

  post = <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    this.request<T>('POST', endpoint, body, options);

  put = <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    this.request<T>('PUT', endpoint, body, options);

  delete = <T>(endpoint: string, options?: RequestInit) =>
    this.request<T>('DELETE', endpoint, undefined, options);

  // Auth
  login = (email: string, password: string): Promise<{ access_token: string; role: string }> => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    return this.request('POST', '/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  };

  register = (data: {
    fullName: string;
    email: string;
    phone: string;
    organization: string;
    position: string;
  }) => this.post('/register', data);

  // Standards
  getStandards = () => this.get<any[]>('/standards');
  getStandardsPage = (params: {
    page?: number;
    limit?: number;
    q?: string;
    spk?: string;
    area?: string;
    only_with_qualifications?: boolean;
  } = {}) => {
    const sp = new URLSearchParams();
    sp.set('page', String(params.page ?? 1));
    sp.set('limit', String(params.limit ?? 40));
    if (params.q) sp.set('q', params.q);
    if (params.spk) sp.set('spk', params.spk);
    if (params.area) sp.set('area', params.area);
    if (params.only_with_qualifications) sp.set('only_with_qualifications', 'true');
    return this.get<{
      items: any[];
      total: number;
      page: number;
      limit: number;
      pages: number;
      with_qualifications_count: number;
      area_counts: Record<string, number>;
    }>(`/standards?${sp.toString()}`);
  };
  getStandardsSpkList = () => this.get<Array<{ name: string; count: number }>>('/standards/spk-list');
  importSpkAssignments = () => this.post<{ status: string; updated: number; xlsx_rows: number }>('/standards/import-spk', {});
  getStandardByRegNumber = (regNumber: string) => this.get<any>(`/standards/${regNumber}`);
  getLaborFunctions = (standardId: number) => this.get<any[]>(`/standards/${standardId}/labor-functions`);
  searchStandards = (query: string, limit = 50, area?: string) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (area) params.set('area', area);
    return this.get<any[]>(`/standards/search?${params.toString()}`);
  };
  getStandardsByOkso = (code: string, limit = 100) => {
    const params = new URLSearchParams({ code, limit: String(limit) });
    return this.get<any[]>(`/standards/by-okso?${params.toString()}`);
  };
  getStandardsByOkpdtr = (code: string, limit = 100) => {
    const params = new URLSearchParams({ code, limit: String(limit) });
    return this.get<any[]>(`/standards/by-okpdtr?${params.toString()}`);
  };
  getStandardPrintHtmlUrl = (regNumber: string) =>
    `${BASE_URL}/standards/${encodeURIComponent(regNumber)}/document`;
  downloadStandardDocx = async (regNumber: string): Promise<Blob> => {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(
      `${BASE_URL}/standards/${encodeURIComponent(regNumber)}/document.docx`,
      { headers }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error ${response.status}`);
    }
    return response.blob();
  };
  getEnrichedStandards = () => this.get<any[]>('/enriched-standards');
  getEnrichedStandard = (regNumber: string) => this.get<any>(`/enriched-standards/${regNumber}`);
  getEnrichmentStats = () =>
    this.get<{ total_raw: number; enriched: number; pending: number; orphaned_enriched?: number }>(
      '/enrichment/stats'
    );

  // Qualifications
  getQualifications = () => this.get<any[]>('/qualifications');
  getQualificationById = (id: number) => this.get<any>(`/qualifications/${id}`);
  getQualificationsByStandard = (standardId: number) => this.get<any[]>(`/qualifications/by-standard/${standardId}`);
  getQualificationsStats = () =>
    this.get<{ local_count: number; expected?: number; missing?: number; index_count?: number }>(
      '/qualifications/stats'
    );
  relinkQualificationsToStandards = () =>
    this.post<{
      status: string;
      linked: number;
      skipped: number;
      not_found: number;
      standards_with_qualifications: number;
      linked_qualifications: number;
    }>('/qualifications/relink-standards', {});
  getPublicQualificationStats = () =>
    this.get<{ local_count: number; expected: number; missing: number }>('/qualifications/public/stats');
  getPublicQualifications = (limit = 6) =>
    this.get<Array<{ id: number; code?: string; name: string; level?: string; activity_area?: string }>>(
      `/qualifications/public?limit=${limit}`
    );
  fetchQualificationsFromNark = (onlyMissing = true) =>
    this.post<{ status: string; only_missing: boolean }>(
      `/fetch-qualifications?only_missing=${onlyMissing ? 'true' : 'false'}`
    );
  getFetchQualificationsStatus = () =>
    this.get<{
      status: string;
      message: string;
      local_count?: number;
      processed?: number;
      failed?: number;
      site_count?: number;
    }>('/fetch-qualifications/status');

  // Assessment tools (NARK OS)
  getAssessmentTools = () => this.get<any[]>('/assessment-tools');
  getAssessmentToolById = (id: number) => this.get<any>(`/assessment-tools/${id}`);
  getAssessmentToolsStats = () =>
    this.get<{
      local_count: number;
      expected?: number;
      missing?: number;
      index_count?: number;
      linked?: number;
      unlinked?: number;
      qualifications_with_os?: number;
    }>('/assessment-tools/stats');
  fetchAssessmentToolsFromNark = (onlyMissing = true) =>
    this.post<{ status: string; only_missing: boolean }>(
      `/fetch-assessment-tools?only_missing=${onlyMissing ? 'true' : 'false'}`
    );
  getFetchAssessmentToolsStatus = () =>
    this.get<{
      status: string;
      message: string;
      local_count?: number;
      processed?: number;
      failed?: number;
      site_count?: number;
      linked?: number;
    }>('/fetch-assessment-tools/status');

  // ФГОС СПО (admin)
  getFgosCategories = () => this.get<any[]>('/fgos/categories');
  getFgosList = (category?: string) =>
    this.get<any[]>(category ? `/fgos?category=${encodeURIComponent(category)}` : '/fgos');
  getFgosById = (id: number) => this.get<any>(`/fgos/${id}`);
  getFgosStats = (category?: string) =>
    this.get<{ local_count: number; source?: string; by_category?: Record<string, number> }>(
      category ? `/fgos/stats?category=${encodeURIComponent(category)}` : '/fgos/stats'
    );

  getMe = () => this.get<{ email: string; role: string }>('/users/me');

  // Reference — уровни квалификации и сформированности (приказ №148н)
  getReferenceBundle = () => this.get<any>('/reference');
  getFormationLevels = () => this.get<any[]>('/reference/formation-levels');
  getQualificationLevels = () => this.get<any[]>('/reference/qualification-levels');
  getQualificationLevel = (level: number) => this.get<any>(`/reference/qualification-levels/${level}`);
  getUniversalSkillsCatalog = () => this.get<any[]>('/reference/universal-skills');
  getStructuredLevelMatrix = () => this.get<any>('/reference/level-matrix/structured');
  getMatrixContext = (level: string | number) =>
    this.get<any>(`/reference/matrix-context?level=${encodeURIComponent(String(level))}`);
  getProfTrainingProfessions = (
    params?: {
      q?: string;
      category?: string;
      section?: string;
      only_active?: boolean;
      limit?: number;
      offset?: number;
    },
    options?: RequestInit,
  ) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.category) sp.set('category', params.category);
    if (params?.section) sp.set('section', params.section);
    if (params?.only_active === false) sp.set('only_active', 'false');
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.offset != null) sp.set('offset', String(params.offset));
    const qs = sp.toString();
    return this.get<{
      total: number;
      items: Array<{
        id: number;
        item_number: string;
        name: string;
        category: string;
        category_label?: string;
        section?: string | null;
        okpdtr_code?: string | null;
        qualification_rank?: string | null;
        is_active?: number;
      }>;
      source_url?: string;
      source_order?: string;
    }>(`/reference/prof-training-professions${qs ? `?${qs}` : ''}`, options);
  };
  searchFgos = (
    params?: { q?: string; categories?: string[]; limit?: number },
    options?: RequestInit,
  ) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.categories?.length) sp.set('categories', params.categories.join(','));
    if (params?.limit != null) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return this.get<{
      total: number;
      items: Array<{
        id: number;
        code: string;
        name: string;
        category: string;
        category_label?: string;
        qualification?: string;
        group_name?: string;
      }>;
    }>(`/fgos/search${qs ? `?${qs}` : ''}`, options);
  };

  suggestCompetenceProfile = (data: {
    qualification_level: string;
    structure?: Record<string, string[]>;
    competence_kind?: string;
  }) => this.post<any>('/competences/suggest-profile', data);

  // Competences — публичный реестр (без авторизации)
  getPublicCompetences = (params?: { q?: string; industry?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.industry) search.set('industry', params.industry);
    if (params?.status) search.set('status', params.status);
    const qs = search.toString();
    return this.get<any[]>(`/competences/public${qs ? `?${qs}` : ''}`);
  };

  getPublicCompetenceStats = () =>
    this.get<{ total: number; active: number; review: number; archived: number }>('/competences/public/stats');

  getPublicCompetenceById = (id: number) => this.get<any>(`/competences/public/${id}`);

  // Competences — авторизованные операции
  getCompetences = () => this.get<any[]>('/competences');
  getCompetenceById = (id: number) => this.get<any>(`/competences/${id}`);
  createCompetence = (data: any) => this.post('/competences', data);
  updateCompetence = (id: number, data: any) => this.put(`/competences/${id}`, data);
  deleteCompetence = (id: number) => this.delete(`/competences/${id}`);
  getCompetenceStats = () => this.get<{ total: number; active: number; review: number; archived: number }>('/competences/stats');

  downloadCompetenceDocx = async (id: number, opts?: { public?: boolean }): Promise<Blob> => {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const path = opts?.public
      ? `/competences/public/${id}/document.docx`
      : `/competences/${id}/document.docx`;
    const response = await fetch(`${BASE_URL}${path}`, { headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error ${response.status}`);
    }
    return response.blob();
  };

  downloadCompetenceDocxFromDraft = async (data: any): Promise<Blob> => {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${BASE_URL}/competences/document.docx`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        typeof errorData.detail === 'string'
          ? errorData.detail
          : errorData.detail
            ? JSON.stringify(errorData.detail)
            : `HTTP error ${response.status}`,
      );
    }
    return response.blob();
  };

  // Coverage
  getCoverage = (standardId: number, selectedTfCodes: string[]) =>
    this.post<any[]>('/competence/coverage', {
      standard_id: standardId,
      selected_tf_codes: selectedTfCodes,
    });

  // Feedback
  sendFeedback = (section: string, text: string) => this.post('/feedback', { section, text });
  getFeedback = () => this.get<any[]>('/feedback');

  // Registrations
  getRegistrations = () => this.get<any[]>('/registrations');

  // Admin: профстандарты
  uploadStandardFile = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ message: string; reg_number: string }>('/upload', formData);
  };

  fetchBulkRegistry = () =>
    this.post<{ status: string; loaded: unknown[] }>('/fetch-registry-bulk');

  runEnrichment = (options?: { regNumber?: string; onlyMissing?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.regNumber) params.set('reg_number', options.regNumber);
    if (options?.onlyMissing === false) params.set('only_missing', 'false');
    const qs = params.toString();
    return this.post<{
      status: string;
      processed: string[];
      failed?: { reg_number: string; error: string }[];
      total_raw?: number;
      enriched?: number;
      pending?: number;
      pending_before?: number;
      requested?: number;
    }>(`/run-enrichment${qs ? `?${qs}` : ''}`);
  };
}

export const apiClient = new ApiClient();
