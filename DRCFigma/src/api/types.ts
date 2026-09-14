// src/api/types.ts — типы, соответствующие FastAPI-моделям

// Аутентификация
export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export interface User {
  email: string;
  role: string;
}

// Профессиональные стандарты (list /standards)
export interface Standard {
  id: number;
  name: string;
  reg_number: string;
  date: string | null;
  professional_area_code: string | null;
  kind_activity: string | null;
  purpose: string | null;
}

// Детальный стандарт (get /standards/{reg_number})
export interface StandardDetail {
  reg_number: string;
  registration_number: string;
  name: string;
  order_number: string | null;
  approval_date: string | null;
  kind_activity: string | null;
  purpose: string | null;
  professional_area_code: string | null;
  okved_codes: string | null;
  generalized_functions: GeneralizedFunction[];
}

export interface GeneralizedFunction {
  code: string;
  name: string;
  level: string;
  possible_job_titles: string | null;
  okz_codes: string | null;
  okpdtr_codes: string | null;
  okso_codes: string | null;
  particular_functions: ParticularFunction[];
}

export interface ParticularFunction {
  code: string;
  name: string;
  sub_qualification: string | null;
  labor_actions: { text: string }[];
  required_skills: string[];
  necessary_knowledges: string[];
}

// Трудовые функции (из /standards/{id}/labor-functions)
export interface LaborFunctionItem {
  id: number;
  code: string;
  name: string;
  otf_code: string;
  otf_name: string;
  labor_actions: string[];
}

// Квалификации (list /qualifications/by-standard/{standard_id})
export interface Qualification {
  id: number;
  code: string;
  name: string;
  labor_functions: { code: string; name: string }[];
}

// Компетенции — создание (POST /competences)
export interface CompetenceCreate {
  name: string;
  qualification_name: string;
  qualification_level: string;
  prof_standard_id: number;
  qualification_id?: number | null;
  labor_functions: { code?: string; name?: string }[];
  structure: Record<string, string[]>;
  descriptors?: Record<string, unknown>;
  discipline_mapping?: { component: string; discipline: string; hours: number; control: string }[];
  ed_technologies?: string[];
  assessment_tools: { level: string; tool: string; criteria: string; for_nok: boolean }[];
  resources?: string[];
  developer: string;
  validator?: string | null;
  status?: string;
  description?: string;
  industry?: string;
  hours?: string;
}

// Компетенция — обновление (PUT /competences/{id})
export type CompetenceUpdate = Partial<CompetenceCreate>;

// Компетенция — ответ API (GET /competences, GET /competences/{id})
export interface Competence {
  id: number;
  name: string;
  qualification_name: string;
  qualification_level: string;
  prof_standard_id: number;
  qualification_id: number | null;
  labor_functions: { code?: string; name?: string }[];
  structure: Record<string, string[]>;
  descriptors: Record<string, unknown>;
  discipline_mapping: { component: string; discipline: string; hours: number; control: string }[];
  ed_technologies: string[];
  assessment_tools: { level: string; tool: string; criteria: string; for_nok: boolean }[];
  resources: string[];
  developer: string;
  validator: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_active: number;
  raw_data: Record<string, unknown>;
}

// Расчёт покрытия (POST /competence/coverage)
export interface CoverageRequest {
  standard_id: number;
  selected_tf_codes: string[];
}

export interface CoverageResult {
  qualification_id: number;
  qualification_code: string;
  qualification_name: string;
  coverage_percent: number;
  total_tf: number;
  covered_tf: number;
  missing_tf: string[];
}

// Обратная связь (POST /feedback)
export interface FeedbackCreate {
  section: string;
  text: string;
}

export interface Feedback {
  id: number;
  section: string;
  text: string;
  created_at: string | null;
}

// Регистрация (POST /register)
export interface RegistrationData {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
}

export interface Registration {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  created_at: string;
}

// Статистика компетенций (GET /competences/stats)
export interface CompetenceStats {
  total: number;
  active: number;
  review: number;
  archived: number;
}
